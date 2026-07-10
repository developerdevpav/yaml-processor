package com.sber.yamlprocessor.graphql

import com.sber.yamlprocessor.model.Configurator
import com.sber.yamlprocessor.model.Process
import com.sber.yamlprocessor.model.Result
import com.sber.yamlprocessor.model.Reverse
import com.sber.yamlprocessor.model.ReverseOutput
import com.sber.yamlprocessor.model.Stage
import com.sber.yamlprocessor.model.Subprocess
import org.springframework.stereotype.Service

@Service
class JpaGraphQlNodeMutationService(
    private val processNodeService: ProcessNodeGraphQlService,
    private val configuratorNodeService: ConfiguratorNodeGraphQlService,
    private val resultNodeService: ResultNodeGraphQlService
) {
    fun updateStage(id: Any?, input: Map<String, Any?>): Stage =
        processNodeService.updateStage(id, input)

    fun createSubprocess(processId: Any?, input: Map<String, Any?>): Subprocess =
        processNodeService.createSubprocess(processId, input)

    fun updateSubprocess(id: Any?, input: Map<String, Any?>): Subprocess =
        processNodeService.updateSubprocess(id, input)

    fun reorderSubprocessStages(subprocessId: Any?, stageIds: List<Any?>): Subprocess =
        processNodeService.reorderSubprocessStages(subprocessId, stageIds)

    fun deleteSubprocess(id: Any?): Boolean =
        processNodeService.deleteSubprocess(id)

    fun createStage(subprocessId: Any?, input: Map<String, Any?>): Stage =
        processNodeService.createStage(subprocessId, input)

    fun updateProcess(id: Any?, input: Map<String, Any?>): Process =
        processNodeService.updateProcess(id, input)

    fun deleteStage(id: Any?): Boolean =
        processNodeService.deleteStage(id)

    fun createConfigurator(stageId: Any?, input: Map<String, Any?>): Configurator =
        configuratorNodeService.create(stageId, input)

    fun updateConfigurator(id: Any?, input: Map<String, Any?>): Configurator =
        configuratorNodeService.update(id, input)

    fun deleteConfigurator(id: Any?): Boolean =
        configuratorNodeService.delete(id)

    fun createResult(configuratorId: Any?, input: Map<String, Any?>): Result =
        resultNodeService.createResult(configuratorId, input)

    fun updateResult(id: Any?, input: Map<String, Any?>): Result =
        resultNodeService.updateResult(id, input)

    fun deleteResult(id: Any?): Boolean =
        resultNodeService.deleteResult(id)

    fun createReverse(resultId: Any?, input: Map<String, Any?>): Reverse =
        resultNodeService.createReverse(resultId, input)

    fun updateReverse(id: Any?, input: Map<String, Any?>): Reverse =
        resultNodeService.updateReverse(id, input)

    fun reorderReverseOutputs(reverseId: Any?, outputIds: List<Any?>): Reverse =
        resultNodeService.reorderReverseOutputs(reverseId, outputIds)

    fun deleteReverse(id: Any?): Boolean =
        resultNodeService.deleteReverse(id)

    fun createReverseOutput(reverseId: Any?, input: Map<String, Any?>): ReverseOutput =
        resultNodeService.createReverseOutput(reverseId, input)

    fun updateReverseOutput(id: Any?, input: Map<String, Any?>): ReverseOutput =
        resultNodeService.updateReverseOutput(id, input)

    fun deleteReverseOutput(id: Any?): Boolean =
        resultNodeService.deleteReverseOutput(id)
}
