package com.sber.yamlprocessor.mcp

import com.sber.yamlprocessor.model.Process
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class McpProcessSearchService(
    private val entityManager: EntityManager
) {
    @Transactional(readOnly = true)
    fun search(arguments: Map<String, Any?>): List<Map<String, Any?>> {
        val query = arguments["query"]?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.lowercase()
        return entityManager.createQuery("select p from Process p", Process::class.java)
            .resultList
            .asSequence()
            .filter { process -> query == null || process.searchText().contains(query) }
            .map { process ->
                mapOf(
                    "id" to process.id,
                    "processConfigId" to process.processConfig?.id,
                    "nodeName" to process.nodeName,
                    "nodeComment" to process.nodeComment,
                    "contextCode" to process.contextCode?.code,
                    "disabled" to process.disabled,
                    "subprocessCount" to process.subprocess.size
                )
            }
            .toList()
    }

    private fun Process.searchText(): String =
        listOfNotNull(
            id?.toString(),
            processConfig?.id?.toString(),
            nodeName,
            nodeComment,
            contextCode?.code
        )
            .joinToString(" ")
            .lowercase()
}
