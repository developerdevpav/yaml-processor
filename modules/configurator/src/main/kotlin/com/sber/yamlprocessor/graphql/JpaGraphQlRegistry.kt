package com.sber.yamlprocessor.graphql

import jakarta.persistence.ElementCollection
import jakarta.persistence.Embeddable
import jakarta.persistence.Embedded
import jakarta.persistence.EntityManagerFactory
import jakarta.persistence.Id
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OneToOne
import jakarta.persistence.metamodel.Attribute
import jakarta.persistence.metamodel.EntityType
import jakarta.persistence.metamodel.PluralAttribute
import org.hibernate.annotations.Immutable
import org.springframework.stereotype.Component
import java.lang.reflect.Field
import java.lang.reflect.Member
import java.lang.reflect.Method
import java.lang.reflect.Modifier

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
        val metamodelJavaType = when (attribute) {
            is PluralAttribute<*, *, *> -> attribute.elementType.javaType
            else -> attribute.javaType
        }
        val targetJavaType = when (attribute) {
            is PluralAttribute<*, *, *> -> metamodelJavaType
            else -> declaredJavaType(member, metamodelJavaType)
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

    private fun declaredJavaType(member: Member, fallback: Class<*>): Class<*> = when (member) {
        is Field -> member.type
        is Method -> member.returnType
        else -> fallback
    }

    private fun graphQlScalar(javaType: Class<*>): String = when (javaType) {
        Boolean::class.javaPrimitiveType, Boolean::class.javaObjectType -> "Boolean"
        Int::class.javaPrimitiveType,
        Int::class.javaObjectType,
        Short::class.javaPrimitiveType, Short::class.javaObjectType -> "Int"
        Float::class.javaPrimitiveType,
        Float::class.javaObjectType,
        Double::class.javaPrimitiveType,
        Double::class.javaObjectType,
        java.math.BigDecimal::class.java -> "Float"
        Long::class.javaPrimitiveType, Long::class.javaObjectType -> "String"
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
