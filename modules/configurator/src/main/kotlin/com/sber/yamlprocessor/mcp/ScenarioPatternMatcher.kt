package com.sber.yamlprocessor.mcp

/**
 * Сопоставляет `b3event.body.service.scenario` со значениями `result.input-scenarios`.
 *
 * Поддерживаемые форматы:
 * - точное совпадение;
 * - явный regexp: `^NEW:.*`, `.*:DONE$`, форма с разделителями `/.../` и флагом `i`;
 * - glob для обратной совместимости: `credit.request.*`, `scenario.?`.
 *
 * @author Sorface Developer
 */
internal object ScenarioPatternMatcher {
    private val slashRegexpPattern = Regex("""^/(.*)/([a-zA-Z]*)$""")

    fun matches(scenario: String?, patterns: List<String>): Boolean {
        val normalizedScenario = scenario?.trim()?.takeIf { it.isNotEmpty() } ?: return false

        return patterns.any { pattern ->
            matchesPattern(normalizedScenario, pattern)
        }
    }

    internal fun matchesPattern(scenario: String, pattern: String): Boolean {
        val normalizedPattern = pattern.trim()
        if (normalizedPattern.isEmpty()) {
            return false
        }

        if (normalizedPattern == scenario) {
            return true
        }

        if (isExplicitRegexpPattern(normalizedPattern)) {
            return regexpMatches(normalizedPattern, scenario)
        }

        return globMatches(normalizedPattern, scenario)
    }

    private fun isExplicitRegexpPattern(pattern: String): Boolean =
        slashRegexpPattern.matches(pattern) ||
            pattern.startsWith("^") ||
            pattern.endsWith("$") ||
            pattern.startsWith("(?")

    private fun regexpMatches(pattern: String, scenario: String): Boolean =
        regexFrom(pattern)
            ?.containsMatchIn(scenario)
            ?: false

    private fun regexFrom(pattern: String): Regex? {
        val slashRegexp = slashRegexpPattern.matchEntire(pattern)
        if (slashRegexp != null) {
            val expression = slashRegexp.groupValues[1]
            val options = regexOptions(slashRegexp.groupValues[2]) ?: return null
            return runCatching { Regex(expression, options) }.getOrNull()
        }

        return runCatching { Regex(pattern) }.getOrNull()
    }

    private fun regexOptions(flags: String): Set<RegexOption>? {
        val options = mutableSetOf<RegexOption>()
        for (flag in flags) {
            when (flag) {
                'i' -> options += RegexOption.IGNORE_CASE
                'm' -> options += RegexOption.MULTILINE
                's' -> options += RegexOption.DOT_MATCHES_ALL
                else -> return null
            }
        }
        return options
    }

    private fun globMatches(pattern: String, scenario: String): Boolean =
        Regex(globToRegex(pattern)).matches(scenario)

    private fun globToRegex(pattern: String): String =
        buildString {
            pattern.forEach { char ->
                when (char) {
                    '*' -> append(".*")
                    '?' -> append(".")
                    else -> append(Regex.escape(char.toString()))
                }
            }
        }
}
