package com.sber.yamlprocessor.graphql

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.graphql.GraphQlProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.graphql.ExecutionGraphQlService
import org.springframework.graphql.execution.DefaultExecutionGraphQlService
import org.springframework.graphql.execution.GraphQlSource

@Configuration
@EnableConfigurationProperties(GraphQlProperties::class)
class JpaGraphQlExecutionConfiguration {

    @Bean
    @ConditionalOnMissingBean(ExecutionGraphQlService::class)
    fun executionGraphQlService(graphQlSource: GraphQlSource): ExecutionGraphQlService =
        DefaultExecutionGraphQlService(graphQlSource)

}
