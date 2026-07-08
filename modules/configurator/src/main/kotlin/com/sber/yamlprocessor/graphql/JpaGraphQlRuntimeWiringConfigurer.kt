package com.sber.yamlprocessor.graphql

import graphql.schema.idl.RuntimeWiring
import org.springframework.graphql.execution.RuntimeWiringConfigurer
import org.springframework.stereotype.Component

@Component
class JpaGraphQlRuntimeWiringConfigurer(
    private val registry: JpaGraphQlRegistry,
    private val service: JpaGraphQlCrudService
) : RuntimeWiringConfigurer {
    override fun configure(builder: RuntimeWiring.Builder) {
        builder.type("Query") { type ->
            registry.entities.values.forEach { entity ->
                type.dataFetcher(entity.queryField) { env ->
                    service.findById(entity, env.getArgument("id"))
                }
                type.dataFetcher(entity.listField) {
                    service.findAll(entity)
                }
            }
            type
        }

        builder.type("Mutation") { type ->
            registry.entities.values.filter { it.mutable }.forEach { entity ->
                type.dataFetcher("create${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.create(entity, env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("update${entity.name}") { env ->
                    @Suppress("UNCHECKED_CAST")
                    service.update(entity, env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
                }
                type.dataFetcher("delete${entity.name}") { env ->
                    service.delete(entity, env.getArgument("id"))
                }
            }
            type.dataFetcher("updateStageNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateStageNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("createSubprocessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createSubprocessNode(env.getArgument("processId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateSubprocessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateSubprocessNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("reorderSubprocessStages") { env ->
                service.reorderSubprocessStages(
                    env.getArgument("subprocessId"),
                    env.getArgument<List<Any?>>("stageIds")
                )
            }
            type.dataFetcher("deleteSubprocessNode") { env ->
                service.deleteSubprocessNode(env.getArgument("id"))
            }
            type.dataFetcher("createStageNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createStageNode(env.getArgument("subprocessId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteStageNode") { env ->
                service.deleteStageNode(env.getArgument("id"))
            }
            type.dataFetcher("createConfiguratorNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createConfiguratorNode(env.getArgument("stageId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateConfiguratorNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateConfiguratorNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteConfiguratorNode") { env ->
                service.deleteConfiguratorNode(env.getArgument("id"))
            }
            type.dataFetcher("createResultNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createResultNode(env.getArgument("configuratorId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateResultNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateResultNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteResultNode") { env ->
                service.deleteResultNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createReverseNode(env.getArgument("resultId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateReverseNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateReverseNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("reorderReverseOutputs") { env ->
                service.reorderReverseOutputs(
                    env.getArgument("reverseId"),
                    env.getArgument<List<Any?>>("outputIds")
                )
            }
            type.dataFetcher("deleteReverseNode") { env ->
                service.deleteReverseNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseOutputNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.createReverseOutputNode(env.getArgument("reverseId"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("updateReverseOutputNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateReverseOutputNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("deleteReverseOutputNode") { env ->
                service.deleteReverseOutputNode(env.getArgument("id"))
            }
            type.dataFetcher("updateProcessNode") { env ->
                @Suppress("UNCHECKED_CAST")
                service.updateProcessNode(env.getArgument("id"), env.getArgument<Map<String, Any?>>("input"))
            }
            type.dataFetcher("renameContextCodesDictionary") { env ->
                service.renameContextCodesDictionary(env.getArgument("id"), env.getArgument("code"))
            }
            type
        }
    }
}
