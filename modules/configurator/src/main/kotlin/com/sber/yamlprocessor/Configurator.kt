package com.sber.yamlprocessor

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class Configurator

fun main(args: Array<String>) {
    runApplication<Configurator>(*args)
}

