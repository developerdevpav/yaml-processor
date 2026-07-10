package com.sber.yamlprocessor.graphql

import com.sber.yamlprocessor.model.ContextCodesDictionary
import jakarta.persistence.EntityManager
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ContextCodesDictionaryGraphQlService(
    private val entityManager: EntityManager
) {
    @Transactional
    fun delete(id: Any?): Boolean {
        val code = id?.toString()?.trim().orEmpty()
        require(code.isNotBlank()) { "Context code id must not be blank" }

        val current = entityManager.find(ContextCodesDictionary::class.java, code) ?: return false
        val processUsageCount = countProcessUsage(code)
        val stageUsageCount = countStageUsage(code)
        require(processUsageCount == 0L && stageUsageCount == 0L) {
            "Код процесса \"$code\" используется: процессов $processUsageCount, стадий $stageUsageCount."
        }

        entityManager.remove(current)
        entityManager.flush()
        return true
    }

    @Transactional
    fun rename(id: Any?, code: String): ContextCodesDictionary {
        val currentCode = id?.toString()?.trim().orEmpty()
        val nextCode = code.trim()

        require(currentCode.isNotBlank()) { "Context code id must not be blank" }
        require(nextCode.isNotBlank()) { "Context code must not be blank" }
        require(nextCode.length <= 64) { "Context code must be 64 characters or less" }

        val current = entityManager.find(ContextCodesDictionary::class.java, currentCode)
            ?: error("ContextCodesDictionary with code=$currentCode not found")

        if (currentCode == nextCode) {
            return current
        }

        require(entityManager.find(ContextCodesDictionary::class.java, nextCode) == null) {
            "ContextCodesDictionary with code=$nextCode already exists"
        }

        val replacement = ContextCodesDictionary(code = nextCode)
        entityManager.persist(replacement)
        entityManager.flush()

        rebindProcessReferences(current, replacement)
        rebindStageReferences(current, replacement)

        entityManager.flush()
        entityManager.clear()

        entityManager.find(ContextCodesDictionary::class.java, currentCode)?.let(entityManager::remove)
        entityManager.flush()
        entityManager.clear()

        return entityManager.find(ContextCodesDictionary::class.java, nextCode)
            ?: error("ContextCodesDictionary with code=$nextCode not found after rename")
    }

    private fun countProcessUsage(code: String): Long =
        entityManager.createQuery(
            "select count(p) from Process p where p.contextCode.code = :code",
            java.lang.Long::class.java
        )
            .setParameter("code", code)
            .singleResult.toLong()

    private fun countStageUsage(code: String): Long =
        entityManager.createQuery(
            "select count(s) from Stage s where s.contextCode.code = :code",
            java.lang.Long::class.java
        )
            .setParameter("code", code)
            .singleResult.toLong()

    private fun rebindProcessReferences(
        current: ContextCodesDictionary,
        replacement: ContextCodesDictionary
    ) {
        entityManager.createQuery(
            "update Process p set p.contextCode = :replacement where p.contextCode = :current"
        )
            .setParameter("replacement", replacement)
            .setParameter("current", current)
            .executeUpdate()
    }

    private fun rebindStageReferences(
        current: ContextCodesDictionary,
        replacement: ContextCodesDictionary
    ) {
        entityManager.createQuery(
            "update Stage s set s.contextCode = :replacement where s.contextCode = :current"
        )
            .setParameter("replacement", replacement)
            .setParameter("current", current)
            .executeUpdate()
    }
}
