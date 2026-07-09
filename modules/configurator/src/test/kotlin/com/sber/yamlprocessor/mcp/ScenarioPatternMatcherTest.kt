package com.sber.yamlprocessor.mcp

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("Сопоставление входящего сценария с input-scenarios")
class ScenarioPatternMatcherTest {

    @Test
    @DisplayName("Возвращает true для regexp-паттерна вида ^NEW:.*")
    fun `matches raw regexp pattern`() {
        assertTrue(ScenarioPatternMatcher.matches("NEW:DealStructuring", listOf("^NEW:.*")))
    }

    @Test
    @DisplayName("Возвращает true для точного совпадения сценария")
    fun `matches exact scenario`() {
        assertTrue(ScenarioPatternMatcher.matches("scenario.mcp", listOf("scenario.mcp")))
    }

    @Test
    @DisplayName("Сохраняет поддержку glob-паттернов")
    fun `matches glob pattern`() {
        assertTrue(ScenarioPatternMatcher.matches("credit.request.created", listOf("credit.request.*")))
    }

    @Test
    @DisplayName("Не трактует glob-паттерн как regexp без явного regexp-признака")
    fun `does not treat glob pattern as raw regexp`() {
        assertFalse(ScenarioPatternMatcher.matches("creditXrequestXcreated", listOf("credit.request.*")))
    }

    @Test
    @DisplayName("Возвращает true для slash regexp с флагом i")
    fun `matches slash regexp with flags`() {
        assertTrue(ScenarioPatternMatcher.matches("new:DealStructuring", listOf("/^NEW:.*/i")))
    }

    @Test
    @DisplayName("Возвращает false для невалидного regexp-паттерна")
    fun `does not match invalid regexp pattern`() {
        assertFalse(ScenarioPatternMatcher.matches("NEW:DealStructuring", listOf("^NEW:(.*")))
    }
}
