package com.sber.yamlprocessor.graphql

import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.Resource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class GraphiQlPageController {

    @GetMapping("/graphiql", produces = [MediaType.TEXT_HTML_VALUE])
    fun graphiQl(): ResponseEntity<Resource> =
        ResponseEntity.ok()
            .contentType(MediaType.TEXT_HTML)
            .body(ClassPathResource("static/graphiql.html"))

}
