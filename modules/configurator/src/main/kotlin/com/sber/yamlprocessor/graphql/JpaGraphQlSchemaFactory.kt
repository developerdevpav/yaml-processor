package com.sber.yamlprocessor.graphql

import org.springframework.stereotype.Component

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
            } + listOf(
                "  createSubprocessNode(processId: ID!, input: SubprocessInput!): Subprocess!",
                "  updateSubprocessNode(id: ID!, input: SubprocessInput!): Subprocess!",
                "  reorderSubprocessStages(subprocessId: ID!, stageIds: [ID!]!): Subprocess!",
                "  deleteSubprocessNode(id: ID!): Boolean!",
                "  createStageNode(subprocessId: ID!, input: StageInput!): Stage!",
                "  updateStageNode(id: ID!, input: StageInput!): Stage!",
                "  deleteStageNode(id: ID!): Boolean!",
                "  createConfiguratorNode(stageId: ID!, input: ConfiguratorInput!): Configurator!",
                "  updateConfiguratorNode(id: ID!, input: ConfiguratorInput!): Configurator!",
                "  deleteConfiguratorNode(id: ID!): Boolean!",
                "  createResultNode(configuratorId: ID!, input: ResultInput!): Result!",
                "  updateResultNode(id: ID!, input: ResultInput!): Result!",
                "  deleteResultNode(id: ID!): Boolean!",
                "  createReverseNode(resultId: ID!, input: ReverseInput!): Reverse!",
                "  updateReverseNode(id: ID!, input: ReverseInput!): Reverse!",
                "  reorderReverseOutputs(reverseId: ID!, outputIds: [ID!]!): Reverse!",
                "  deleteReverseNode(id: ID!): Boolean!",
                "  createReverseOutputNode(reverseId: ID!, input: ReverseOutputInput!): ReverseOutput!",
                "  updateReverseOutputNode(id: ID!, input: ReverseOutputInput!): ReverseOutput!",
                "  deleteReverseOutputNode(id: ID!): Boolean!",
                "  updateProcessNode(id: ID!, input: ProcessInput!): Process!",
                "  renameContextCodesDictionary(id: ID!, code: String!): ContextCodesDictionary!"
            )

        val types = registry.entities.values.joinToString("\n\n") { renderComplexType(it) }
        val embeddables = registry.embeddables.values.joinToString("\n\n") { renderComplexType(it) }
        val inputs = registry.entities.values.joinToString("\n\n") { renderInputType(it) }
        val embeddableInputs = registry.embeddables.values.joinToString("\n\n") { renderInputType(it) }
        val refs = registry.referenceInputs.values.joinToString("\n\n") { ref ->
            buildString {
                appendLine("input ${ref.name} {")
                appendLine("  ${ref.idField}: ID!")
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
}
