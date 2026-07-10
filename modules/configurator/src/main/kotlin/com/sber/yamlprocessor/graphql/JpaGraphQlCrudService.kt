package com.sber.yamlprocessor.graphql

import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.ContextCodesDictionary
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.ProcessConfig
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import org.springframework.stereotype.Service

@Service
class JpaGraphQlCrudService(
    private val genericCrudService: JpaGraphQlGenericCrudService,
    private val nodeMutationService: JpaGraphQlNodeMutationService,
    private val contextCodesDictionaryService: ContextCodesDictionaryGraphQlService
) {
    fun findProcessConfigForExport(id: Any?): ProcessConfig =
        genericCrudService.findProcessConfigForExport(id)

    fun findById(entity: EntityMetadata, id: Any?): Any? =
        genericCrudService.findById(entity, id)

    fun findAll(entity: EntityMetadata): List<Any> =
        genericCrudService.findAll(entity)

    fun create(entity: EntityMetadata, input: Map<String, Any?>): Any =
        genericCrudService.create(entity, input)

    fun update(entity: EntityMetadata, id: Any?, input: Map<String, Any?>): Any =
        genericCrudService.update(entity, id, input)

    fun updateStageNode(id: Any?, input: Map<String, Any?>): Stage =
        nodeMutationService.updateStage(id, input)

    fun createSubprocessNode(processId: Any?, input: Map<String, Any?>): Subprocess =
        nodeMutationService.createSubprocess(processId, input)

    fun updateSubprocessNode(id: Any?, input: Map<String, Any?>): Subprocess =
        nodeMutationService.updateSubprocess(id, input)

    fun reorderSubprocessStages(subprocessId: Any?, stageIds: List<Any?>): Subprocess =
        nodeMutationService.reorderSubprocessStages(subprocessId, stageIds)

    fun deleteSubprocessNode(id: Any?): Boolean =
        nodeMutationService.deleteSubprocess(id)

    fun createStageNode(subprocessId: Any?, input: Map<String, Any?>): Stage =
        nodeMutationService.createStage(subprocessId, input)

    fun updateProcessNode(id: Any?, input: Map<String, Any?>): Process =
        nodeMutationService.updateProcess(id, input)

    fun deleteStageNode(id: Any?): Boolean =
        nodeMutationService.deleteStage(id)

    fun createConfiguratorNode(stageId: Any?, input: Map<String, Any?>): Configurator =
        nodeMutationService.createConfigurator(stageId, input)

    fun updateConfiguratorNode(id: Any?, input: Map<String, Any?>): Configurator =
        nodeMutationService.updateConfigurator(id, input)

    fun deleteConfiguratorNode(id: Any?): Boolean =
        nodeMutationService.deleteConfigurator(id)

    fun createResultNode(configuratorId: Any?, input: Map<String, Any?>): Result =
        nodeMutationService.createResult(configuratorId, input)

    fun updateResultNode(id: Any?, input: Map<String, Any?>): Result =
        nodeMutationService.updateResult(id, input)

    fun deleteResultNode(id: Any?): Boolean =
        nodeMutationService.deleteResult(id)

    fun createReverseNode(resultId: Any?, input: Map<String, Any?>): Reverse =
        nodeMutationService.createReverse(resultId, input)

    fun updateReverseNode(id: Any?, input: Map<String, Any?>): Reverse =
        nodeMutationService.updateReverse(id, input)

    fun reorderReverseOutputs(reverseId: Any?, outputIds: List<Any?>): Reverse =
        nodeMutationService.reorderReverseOutputs(reverseId, outputIds)

    fun deleteReverseNode(id: Any?): Boolean =
        nodeMutationService.deleteReverse(id)

    fun createReverseOutputNode(reverseId: Any?, input: Map<String, Any?>): ReverseOutput =
        nodeMutationService.createReverseOutput(reverseId, input)

    fun updateReverseOutputNode(id: Any?, input: Map<String, Any?>): ReverseOutput =
        nodeMutationService.updateReverseOutput(id, input)

    fun deleteReverseOutputNode(id: Any?): Boolean =
        nodeMutationService.deleteReverseOutput(id)

    fun delete(entity: EntityMetadata, id: Any?): Boolean =
        if (entity.javaType == ContextCodesDictionary::class.java) {
            contextCodesDictionaryService.delete(id)
        } else {
            genericCrudService.delete(entity, id)
        }

    fun renameContextCodesDictionary(id: Any?, code: String): ContextCodesDictionary =
        contextCodesDictionaryService.rename(id, code)
}
