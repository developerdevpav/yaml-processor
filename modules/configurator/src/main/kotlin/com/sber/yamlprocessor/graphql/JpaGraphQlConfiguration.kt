package com.sber.yamlprocessor.graphql

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.ByteArrayResource
import org.springframework.graphql.execution.GraphQlSource
import java.nio.charset.StandardCharsets

@Configuration
class JpaGraphQlConfiguration {
    @Bean
    fun jpaGraphQlSource(
        schemaFactory: JpaGraphQlSchemaFactory,
        runtimeWiringConfigurer: JpaGraphQlRuntimeWiringConfigurer
    ): GraphQlSource {
        val schema = schemaFactory.render()
        return GraphQlSource.schemaResourceBuilder()
            .schemaResources(ByteArrayResource(schema.toByteArray(StandardCharsets.UTF_8)))
            .configureRuntimeWiring(runtimeWiringConfigurer)
            .build()
    }
}
