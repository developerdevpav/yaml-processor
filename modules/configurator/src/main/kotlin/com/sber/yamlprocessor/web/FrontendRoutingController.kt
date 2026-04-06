package com.sber.yamlprocessor.web

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@Controller
class FrontendRoutingController {

    @GetMapping(
        value = [
            "/",
            "/{path:[^.]*}",
            "/{path:[^.]*}/{subpath:[^.]*}",
            "/{path:[^.]*}/{subpath:[^.]*}/{subsubpath:[^.]*}"
        ]
    )
    fun forwardToFrontend(): String = "forward:/index.html"
}
