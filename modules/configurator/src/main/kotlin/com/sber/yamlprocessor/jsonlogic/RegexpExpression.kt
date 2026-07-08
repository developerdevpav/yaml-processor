package com.sber.yamlprocessor.jsonlogic

import io.github.jamsesso.jsonlogic.evaluator.JsonLogicEvaluationException
import io.github.jamsesso.jsonlogic.evaluator.expressions.PreEvaluatedArgumentsExpression
import java.util.regex.Pattern
import java.util.regex.PatternSyntaxException

/**
 * JsonLogic-оператор `regexp`.
 *
 * Проверяет первое вычисленное значение по одному или нескольким регулярным выражениям.
 * Возвращает `true`, если хотя бы один шаблон нашёл совпадение в строковом представлении значения.
 */
object RegexpExpression : PreEvaluatedArgumentsExpression {

    override fun key(): String = "regexp"

    override fun evaluate(arguments: MutableList<Any?>, data: Any?, jsonPath: String): Any {
        if (arguments.size < 2) {
            return false
        }

        val value = arguments.firstOrNull()?.toString() ?: return false
        return arguments
            .drop(1)
            .filterNotNull()
            .map { it.toString() }
            .any { pattern -> matches(value, pattern, jsonPath) }
    }

    private fun matches(value: String, pattern: String, jsonPath: String): Boolean =
        try {
            Pattern.compile(pattern).matcher(value).find()
        } catch (exception: PatternSyntaxException) {
            throw JsonLogicEvaluationException(
                "regexp operator received invalid pattern '$pattern': ${exception.description}",
                jsonPath
            )
        }
}
