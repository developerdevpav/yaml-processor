package com.sber.yamlprocessor.graphql

import com.fasterxml.jackson.databind.ObjectMapper
import com.sber.yamlprocessor.model.Stage
import graphql.schema.idl.RuntimeWiring
import jakarta.persistence.ElementCollection
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import jakarta.persistence.Id
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.metamodel.Attribute
import jakarta.persistence.metamodel.EntityType
import jakarta.persistence.metamodel.PluralAttribute
import org.hibernate.Hibernate
import org.hibernate.annotations.Immutable
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.ByteArrayResource
import org.springframework.graphql.execution.GraphQlSource
import org.springframework.graphql.execution.RuntimeWiringConfigurer
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.lang.reflect.Field
import java.lang.reflect.Member
import java.lang.reflect.Modifier
import java.nio.charset.StandardCharsets
import java.util.Collections
import java.util.IdentityHashMap

@Configuration
class JpaGraphQlConfiguration {
    @Bean
    fun jpaGraphQlSource(
        schemaFactory: JpaGraphQlSchemaFactory,
        runtimeWiringConfigurer: RuntimeWiringConfigurer
    ): GraphQlSource {
        val schema = schemaFactory.render()
        return GraphQlSource.schemaResourceBuilder()
            .schemaResources(ByteArrayResource(schema.toByteArray(StandardCharsets.UTF_8)))
            .configureRuntimeWiring(runtimeWiringConfigurer)
            .build()
    }
}

@Component
class JpaGraphQlSchemaFactory(
    private val registry: JpaGraphQlRegistry
) {
    fun render(): String {
        val queryFields = registry.entities.values.flatMap { entity ->
            listOf(
                "  ${entity.queryField}(id: ID!): ${entity.name}",
                "  ${entity.listField}: [${entity.name}!]!"
            )
        }

        val mutationFields = registry.entities.values
            .filter { it.mutable }
            .flatMap { entity ->
                listOf(
                    "  create${entity.name}(input: ${entity.inputName}!): ${entity.name}!",
                    "  update${entity.name}(id: ID!, input: ${entity.inputName}!): ${entity.name}!",
                    "  delete${entity.name}(id: ID!): Boolean!"
                )
            } + listOf("  updateStageNode(id: ID!, input: StageInput!): Stage!")

        val types = registry.entities.values.joinToString("\n\n") { renderComplexType(it) }
        val embeddables = registry.embeddables.values.joinToString("\n\n") { renderComplexType(it) }
        val inputs = registry.entities.values.joinToString("\n\n") { renderInputType(it) }
        val embeddableInputs = registry.embeddables.values.joinToString("\n\n") { renderInputType(it) }
        val refs = registry.referenceInputs.values.joinToString("\n\n") { ref ->
            buildString {
                appendLine("input ${ref.name} {")
                appendLine("  ${ref.idField}: ${graphQlScalar(ref.idType, true)}!")
                append("}")
            }
        }

        return buildString {
            appendLine("type Query {")
            queryFields.forEach(::appendLine)
            appendLine("}")
            if (mutationFields.isNotEmpty()) {
                appendLine()
                appendLine("type Mutation {")
                mutationFields.forEach(::appendLine)
                appendLine("}")
            }
            appendLine()
            appendLine(types)
            if (embeddables.isNotBlank()) {
                appendLine()
                appendLine(embeddables)
            }
            appendLine()
            appendLine(inputs)
            if (embeddableInputs.isNotBlank()) {
                appendLine()
                appendLine(embeddableInputs)
            }
            if (refs.isNotBlank()) {
                appendLine()
                appendLine(refs)
            }
        }
    }

    private fun renderComplexType(type: ComplexTypeMetadata): String = buildString {
        appendLine("type ${type.name} {")
        type.fields.forEach { field ->
            appendLine("  ${field.name}: ${field.outputType}")
        }
        append("}")
    }

    private fun renderInputType(type: ComplexTypeMetadata): String = buildString {
        appendLine("input ${type.inputName} {")
        type.fields.filter { it.inputType != null }.forEach { field ->
            appendLine("  ${field.name}: ${field.inputType}")
        }
        append("}")
    }

    private fun graphQlScalar(javaType: Class<*>, id: Boolean = false): String {
        if (id) {
            return "ID"
        }
        return when (javaType) {
            java.lang.Boolean::class.java, Boolean::class.javaPrimitiveType -> "Boolean"
            java.lang.Integer::class.java, Int::class.javaPrimitiveType,
            java.lang.Short::class.java, Short::class.javaPrimitiveType -> "Int"
            java.lang.Float::class.java, Float::class.javaPrimitiveType,
            java.lang.Double::class.java, Double::class.javaPrimitiveType,
            java.math.BigDecimal::class.java -> "Float"
            else -> "String"
        }
    }
}

@Component
class JpaGraphQlRuntimeWiringConfigurer(
    private val registry: JpaGraphQlRegistry,
    private val service: JpaGraphQlCrudService
) : RuntimeWiringConfigurer {
    override fun configure(builder: RuntimeWiring.Builder) {
        builder.type("Query") { type ->
            registry.entities.values.forEach { entity ->
                type.dataFetcher(entity.queryField) { env ->
                    service.findById(entity, env.getArgument("id"))
                }
                type.dataFetcher(entity.listField) {
                    service.findAll(entity)
                }
            }
            type
        }

        builder.type("Mutation") { type ->
            registry.entities.values.filter { it.mutable }.forEach { entity ->
                type.dataFetcher("create${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.create(entity, env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("update${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.update(entity, env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("delete${entity.name}") { env ->
                    service.delete(entity, env.getArgument("id"))
                }
            }
            type.dataFetcher("updateStageNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateStageNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type
        }
    }
}

@Service
class JpaGraphQlCrudService(
    private val entityManager: EntityManager,
    private val objectMapper: ObjectMapper,
    private val registry: JpaGraphQlRegistry
) {
    @Transactional(readOnly = true)
    fun findById(entity: EntityMetadata, id: Any?): Any? =
        entityManager.find(entity.javaType, convertId(id, entity.idJavaType))
            ?.also { initializeGraph(it, entity) }

    @Transactional(readOnly = true)
    fun findAll(entity: EntityMetadata): List<Any> =
        entityManager.createQuery("select e from ${entity.jpaName} e", entity.javaType)
            .resultList
            .map { it as Any }
            .onEach { initializeGraph(it, entity) }

    @Transactional
    fun create(entity: EntityMetadata, input: Map<String, Any?>): Any {
        val instance = objectMapper.convertValue(input, entity.javaType)
        sanitize(instance, entity)
        entityManager.persist(instance)
        entityManager.flush()
        initializeGraph(instance, entity)
        return instance
    }

    @Transactional
    fun update(entity: EntityMetadata, id: Any?, input: Map<String, Any?>): Any {
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(entity.javaType, entityId)
            ?: error("${entity.name} with id=$entityId not found")
        val instance = objectMapper.convertValue(input, entity.javaType)
        setFieldValue(instance, entity.idField.name, entityId)
        alignChildIdentifiers(current, instance, entity)
        sanitize(instance, entity)
        val merged = entityManager.merge(instance)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged
    }

    @Transactional
    fun updateStageNode(id: Any?, input: Map<String, Any?>): Stage {
        val entity = registry.entity(Stage::class.java)
        val entityId = convertId(id, entity.idJavaType)
        val current = entityManager.find(Stage::class.java, entityId)
            ?: error("Stage with id=$entityId not found")
        val incoming = objectMapper.convertValue(input, Stage::class.java)

        setFieldValue(incoming, entity.idField.name, entityId)
        incoming.subprocess = current.subprocess
        alignChildIdentifiers(current, incoming, entity)
        sanitize(incoming, entity)

        val merged = entityManager.merge(incoming)
        entityManager.flush()
        initializeGraph(merged, entity)
        return merged as Stage
    }

    @Transactional
    fun delete(entity: EntityMetadata, id: Any?): Boolean {
        val managed = entityManager.find(entity.javaType, convertId(id, entity.idJavaType)) ?: return false
        entityManager.remove(managed)
        entityManager.flush()
        return true
    }

    private fun sanitize(value: Any?, type: ComplexTypeMetadata) {
        if (value == null) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Unit
                FieldKind.EMBEDDED -> sanitize(current, registry.complexType(field.targetClass))
                FieldKind.ENTITY_REFERENCE -> {
                    val target = registry.entity(field.targetClass)
                    val refId = getFieldValue(current, target.idField.name)
                    if (refId == null) {
                        if (isInMemoryBackReference(current, value, target)) {
                            return@forEach
                        }
                        error("Reference ${field.name} must include ${target.idField.name}")
                    }
                    setFieldValue(value, field.name, entityManager.getReference(target.javaType, convertId(refId, target.idJavaType)))
                }
                FieldKind.ENTITY_CHILD -> {
                    field.inverseField?.let { setFieldValue(current, it, value) }
                    sanitize(current, registry.entity(field.targetClass))
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    @Suppress("UNCHECKED_CAST")
                    (current as Iterable<Any>).forEach { child ->
                        field.inverseField?.let { setFieldValue(child, it, value) }
                        sanitize(child, registry.entity(field.targetClass))
                    }
                }
            }
        }
    }

    private fun isInMemoryBackReference(reference: Any, owner: Any, target: EntityMetadata): Boolean =
        target.fields
            .filter { candidate ->
                candidate.kind == FieldKind.ENTITY_CHILD || candidate.kind == FieldKind.ENTITY_CHILD_COLLECTION
            }
            .any { candidate ->
                val linked = getFieldValue(reference, candidate.name) ?: return@any false
                when (candidate.kind) {
                    FieldKind.ENTITY_CHILD -> linked === owner
                    FieldKind.ENTITY_CHILD_COLLECTION -> (linked as? Iterable<*>)?.any { it === owner } == true
                    else -> false
                }
            }

    private fun alignChildIdentifiers(current: Any?, incoming: Any?, type: ComplexTypeMetadata) {
        if (current == null || incoming == null) {
            return
        }

        if (type is EntityMetadata && getFieldValue(incoming, type.idField.name) == null) {
            setFieldValue(incoming, type.idField.name, getFieldValue(current, type.idField.name))
        }

        type.fields.forEach { field ->
            val currentValue = getFieldValue(current, field.name) ?: return@forEach
            val incomingValue = getFieldValue(incoming, field.name) ?: return@forEach

            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION, FieldKind.ENTITY_REFERENCE -> Unit
                FieldKind.EMBEDDED -> alignChildIdentifiers(
                    currentValue,
                    incomingValue,
                    registry.complexType(field.targetClass)
                )
                FieldKind.ENTITY_CHILD -> alignChildIdentifiers(
                    currentValue,
                    incomingValue,
                    registry.entity(field.targetClass)
                )
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    val childType = registry.entity(field.targetClass)
                    val currentItems = (currentValue as? Iterable<*>)?.toList().orEmpty()
                    val incomingItems = (incomingValue as? Iterable<*>)?.toList().orEmpty()
                    incomingItems.forEachIndexed { index, child ->
                        val existingChild = currentItems.getOrNull(index) ?: return@forEachIndexed
                        if (child != null) {
                            alignChildIdentifiers(existingChild, child, childType)
                        }
                    }
                }
            }
        }
    }

    private fun initializeGraph(value: Any?, type: ComplexTypeMetadata) {
        val visited = Collections.newSetFromMap(IdentityHashMap<Any, Boolean>())
        initializeGraph(value, type, visited)
    }

    private fun initializeGraph(value: Any?, type: ComplexTypeMetadata, visited: MutableSet<Any>) {
        if (value == null || !visited.add(value)) {
            return
        }

        type.fields.forEach { field ->
            val current = getFieldValue(value, field.name) ?: return@forEach
            when (field.kind) {
                FieldKind.SCALAR, FieldKind.SCALAR_COLLECTION -> Hibernate.initialize(current)
                FieldKind.EMBEDDED -> initializeGraph(current, registry.complexType(field.targetClass), visited)
                FieldKind.ENTITY_REFERENCE -> {
                    Hibernate.initialize(current)
                    initializeGraph(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD -> {
                    Hibernate.initialize(current)
                    initializeGraph(current, registry.entity(field.targetClass), visited)
                }
                FieldKind.ENTITY_CHILD_COLLECTION -> {
                    Hibernate.initialize(current)
                    @Suppress("UNCHECKED_CAST")
                    (current as Iterable<Any>).forEach { child ->
                        initializeGraph(child, registry.entity(field.targetClass), visited)
                    }
                }
            }
        }
    }

    private fun convertId(raw: Any?, targetType: Class<*>): Any {
        require(raw != null) { "ID argument is required" }
        return when (targetType) {
            java.lang.Long::class.java, Long::class.javaPrimitiveType -> when (raw) {
                is Number -> raw.toLong()
                else -> raw.toString().toLong()
            }
            java.lang.Integer::class.java, Int::class.javaPrimitiveType -> when (raw) {
                is Number -> raw.toInt()
                else -> raw.toString().toInt()
            }
            java.lang.Boolean::class.java, Boolean::class.javaPrimitiveType -> when (raw) {
                is Boolean -> raw
                else -> raw.toString().toBoolean()
            }
            else -> raw.toString()
        }
    }
}

@Component
class JpaGraphQlRegistry(
    entityManagerFactory: EntityManagerFactory
) {
    lateinit var entities: Map<Class<*>, EntityMetadata>
    lateinit var embeddables: Map<Class<*>, ComplexTypeMetadata>
    lateinit var referenceInputs: Map<Class<*>, ReferenceInputMetadata>

    init {
        val metamodel = entityManagerFactory.metamodel
        val entityTypes = metamodel.entities
            .filter { !Modifier.isAbstract(it.javaType.modifiers) }
            .sortedBy { it.name }

        val embeddableClasses = linkedSetOf<Class<*>>()
        val builtEntities = linkedMapOf<Class<*>, EntityMetadata>()

        entityTypes.forEach { entityType ->
            builtEntities[entityType.javaType] = buildEntity(entityType, embeddableClasses)
        }

        val builtEmbeddables = linkedMapOf<Class<*>, ComplexTypeMetadata>()
        while (true) {
            val nextClass = embeddableClasses
                .firstOrNull { !builtEmbeddables.containsKey(it) }
                ?: break
            builtEmbeddables[nextClass] = buildEmbeddable(nextClass, embeddableClasses)
        }

        entities = builtEntities
        embeddables = builtEmbeddables
        referenceInputs = builtEntities.values.associate { entity ->
            entity.javaType to ReferenceInputMetadata(
                name = "${entity.name}RefInput",
                idField = entity.idField.name,
                idType = entity.idJavaType
            )
        }
    }

    fun entity(javaType: Class<*>): EntityMetadata =
        entities[javaType] ?: error("Entity metadata not found for ${javaType.name}")

    fun complexType(javaType: Class<*>): ComplexTypeMetadata =
        entities[javaType] ?: embeddables[javaType] ?: error("Complex type metadata not found for ${javaType.name}")

    private fun buildEntity(entityType: EntityType<*>, embeddableClasses: MutableSet<Class<*>>): EntityMetadata {
        val idField = findIdField(entityType.javaType)
        val fields = entityType.attributes
            .sortedBy { it.name }
            .map { buildEntityField(entityType, it, embeddableClasses) }

        return EntityMetadata(
            name = entityType.javaType.simpleName,
            inputName = "${entityType.javaType.simpleName}Input",
            javaType = entityType.javaType,
            jpaName = entityType.name,
            queryField = entityType.javaType.simpleName.replaceFirstChar { it.lowercase() },
            listField = "${entityType.javaType.simpleName.replaceFirstChar { it.lowercase() }}List",
            mutable = !entityType.javaType.isAnnotationPresent(Immutable::class.java),
            idField = idField,
            idJavaType = idField.type,
            fields = fields
        )
    }

    private fun buildEmbeddable(javaType: Class<*>, embeddableClasses: MutableSet<Class<*>>): ComplexTypeMetadata {
        val fields = allFields(javaType)
            .filterNot(::isStaticOrSynthetic)
            .sortedBy(Field::getName)
            .map { buildReflectionField(javaType, it, embeddableClasses) }

        return ComplexTypeMetadata(
            name = javaType.simpleName,
            inputName = "${javaType.simpleName}Input",
            javaType = javaType,
            fields = fields
        )
    }

    private fun buildEntityField(
        ownerType: EntityType<*>,
        attribute: Attribute<*, *>,
        embeddableClasses: MutableSet<Class<*>>
    ): FieldMetadata {
        val member = attribute.javaMember
        val fieldName = attribute.name
        val isId = hasAnnotation(member, Id::class.java)
        val targetJavaType = when (attribute) {
            is PluralAttribute<*, *, *> -> attribute.elementType.javaType
            else -> attribute.javaType
        }

        if (isId) {
            return FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = "ID",
                inputType = "ID",
                inverseField = null
            )
        }

        return when (attribute.persistentAttributeType) {
            Attribute.PersistentAttributeType.BASIC -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = graphQlScalar(targetJavaType),
                inputType = graphQlScalar(targetJavaType),
                inverseField = null
            )
            Attribute.PersistentAttributeType.ELEMENT_COLLECTION -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR_COLLECTION,
                targetClass = targetJavaType,
                outputType = "[${graphQlScalar(targetJavaType)}!]",
                inputType = "[${graphQlScalar(targetJavaType)}!]",
                inverseField = null
            )
            Attribute.PersistentAttributeType.EMBEDDED -> {
                embeddableClasses += targetJavaType
                FieldMetadata(
                    name = fieldName,
                    kind = FieldKind.EMBEDDED,
                    targetClass = targetJavaType,
                    outputType = targetJavaType.simpleName,
                    inputType = "${targetJavaType.simpleName}Input",
                    inverseField = null
                )
            }
            Attribute.PersistentAttributeType.MANY_TO_ONE -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.ENTITY_REFERENCE,
                targetClass = targetJavaType,
                outputType = targetJavaType.simpleName,
                inputType = "${targetJavaType.simpleName}RefInput",
                inverseField = null
            )
            Attribute.PersistentAttributeType.ONE_TO_MANY -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.ENTITY_CHILD_COLLECTION,
                targetClass = targetJavaType,
                outputType = "[${targetJavaType.simpleName}!]",
                inputType = "[${targetJavaType.simpleName}Input!]",
                inverseField = findInverseField(targetJavaType, ownerType.javaType)
            )
            Attribute.PersistentAttributeType.ONE_TO_ONE -> {
                val nestedInput = includeOneToOneInInput(member)
                FieldMetadata(
                    name = fieldName,
                    kind = if (nestedInput) FieldKind.ENTITY_CHILD else FieldKind.ENTITY_REFERENCE,
                    targetClass = targetJavaType,
                    outputType = targetJavaType.simpleName,
                    inputType = if (nestedInput) "${targetJavaType.simpleName}Input" else null,
                    inverseField = if (nestedInput) findInverseField(targetJavaType, ownerType.javaType) else null
                )
            }
            else -> FieldMetadata(
                name = fieldName,
                kind = FieldKind.SCALAR,
                targetClass = targetJavaType,
                outputType = "String",
                inputType = "String",
                inverseField = null
            )
        }
    }

    private fun buildReflectionField(
        ownerType: Class<*>,
        field: Field,
        embeddableClasses: MutableSet<Class<*>>
    ): FieldMetadata {
        val javaType = field.type
        if (field.isAnnotationPresent(Embedded::class.java) || javaType.isAnnotationPresent(Embeddable::class.java)) {
            embeddableClasses += javaType
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.EMBEDDED,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = "${javaType.simpleName}Input",
                inverseField = null
            )
        }

        if (field.isAnnotationPresent(ManyToOne::class.java)) {
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.ENTITY_REFERENCE,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = "${javaType.simpleName}RefInput",
                inverseField = null
            )
        }

        if (field.isAnnotationPresent(OneToOne::class.java)) {
            val nestedInput = includeOneToOneInInput(field)
            return FieldMetadata(
                name = field.name,
                kind = if (nestedInput) FieldKind.ENTITY_CHILD else FieldKind.ENTITY_REFERENCE,
                targetClass = javaType,
                outputType = javaType.simpleName,
                inputType = if (nestedInput) "${javaType.simpleName}Input" else null,
                inverseField = if (nestedInput) findInverseField(javaType, ownerType) else null
            )
        }

        if (field.isAnnotationPresent(OneToMany::class.java) || field.isAnnotationPresent(ElementCollection::class.java)) {
            return FieldMetadata(
                name = field.name,
                kind = FieldKind.SCALAR_COLLECTION,
                targetClass = String::class.java,
                outputType = "[String!]",
                inputType = "[String!]",
                inverseField = null
            )
        }

        return FieldMetadata(
            name = field.name,
            kind = FieldKind.SCALAR,
            targetClass = javaType,
            outputType = graphQlScalar(javaType),
            inputType = graphQlScalar(javaType),
            inverseField = null
        )
    }

    private fun includeOneToOneInInput(member: Member): Boolean {
        val annotation = annotation(member, OneToOne::class.java) ?: return false
        return annotation.orphanRemoval || annotation.cascade.any {
            it == jakarta.persistence.CascadeType.ALL ||
                it == jakarta.persistence.CascadeType.PERSIST ||
                it == jakarta.persistence.CascadeType.MERGE
        }
    }

    private fun findInverseField(targetType: Class<*>, ownerType: Class<*>): String? =
        allFields(targetType)
            .firstOrNull { field ->
                !isStaticOrSynthetic(field) &&
                    (field.isAnnotationPresent(ManyToOne::class.java) || field.isAnnotationPresent(OneToOne::class.java)) &&
                    field.type == ownerType
            }
            ?.name

    private fun graphQlScalar(javaType: Class<*>): String = when (javaType) {
        java.lang.Boolean::class.java, Boolean::class.javaPrimitiveType -> "Boolean"
        java.lang.Integer::class.java, Int::class.javaPrimitiveType,
        java.lang.Short::class.java, Short::class.javaPrimitiveType -> "Int"
        java.lang.Float::class.java, Float::class.javaPrimitiveType,
        java.lang.Double::class.java, Double::class.javaPrimitiveType,
        java.math.BigDecimal::class.java -> "Float"
        java.lang.Long::class.java, Long::class.javaPrimitiveType -> "String"
        else -> "String"
    }

    private fun findIdField(javaType: Class<*>): Field =
        allFields(javaType).firstOrNull { it.isAnnotationPresent(Id::class.java) }
            ?: error("Entity ${javaType.name} does not have @Id field")

    private fun allFields(javaType: Class<*>): List<Field> {
        val fields = mutableListOf<Field>()
        var current: Class<*>? = javaType
        while (current != null && current != Any::class.java) {
            fields += current.declaredFields
            current = current.superclass
        }
        return fields
    }

    private fun isStaticOrSynthetic(field: Field): Boolean = field.isSynthetic || Modifier.isStatic(field.modifiers)

    private fun <A : Annotation> hasAnnotation(member: Member, type: Class<A>): Boolean = annotation(member, type) != null

    private fun <A : Annotation> annotation(member: Member, type: Class<A>): A? = when (member) {
        is Field -> member.getAnnotation(type)
        is java.lang.reflect.Method -> member.getAnnotation(type)
        else -> null
    }
}

open class ComplexTypeMetadata(
    val name: String,
    val inputName: String,
    val javaType: Class<*>,
    val fields: List<FieldMetadata>
)

class EntityMetadata(
    name: String,
    inputName: String,
    javaType: Class<*>,
    val jpaName: String,
    val queryField: String,
    val listField: String,
    val mutable: Boolean,
    val idField: Field,
    val idJavaType: Class<*>,
    fields: List<FieldMetadata>
) : ComplexTypeMetadata(name, inputName, javaType, fields)

data class ReferenceInputMetadata(
    val name: String,
    val idField: String,
    val idType: Class<*>
)

data class FieldMetadata(
    val name: String,
    val kind: FieldKind,
    val targetClass: Class<*>,
    val outputType: String,
    val inputType: String?,
    val inverseField: String?
)

enum class FieldKind {
    SCALAR,
    SCALAR_COLLECTION,
    EMBEDDED,
    ENTITY_REFERENCE,
    ENTITY_CHILD,
    ENTITY_CHILD_COLLECTION
}

private fun getFieldValue(target: Any, fieldName: String): Any? {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    return field.get(target)
}

private fun setFieldValue(target: Any, fieldName: String, value: Any?) {
    val field = findField(target.javaClass, fieldName)
    field.isAccessible = true
    field.set(target, value)
}

private fun findField(javaType: Class<*>, fieldName: String): Field {
    var current: Class<*>? = javaType
    while (current != null && current != Any::class.java) {
        runCatching { current.getDeclaredField(fieldName) }.getOrNull()?.let { return it }
        current = current.superclass
    }
    error("Field $fieldName not found in ${javaType.name}")
}
