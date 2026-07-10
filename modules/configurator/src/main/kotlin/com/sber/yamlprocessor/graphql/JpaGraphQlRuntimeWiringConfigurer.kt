package com.sber.yamlprocessor.graphql

import graphql.schema.DataFetchingEnvironment
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
                    service.create(entity, inputArgument(env))
                }
                type.dataFetcher("update${entity.name}") { env ->
                    service.update(entity, env.getArgument("id"), inputArgument(env))
                }
                type.dataFetcher("delete${entity.name}") { env ->
                    service.delete(entity, env.getArgument("id"))
                }
            }
            type.dataFetcher("updateStageNode") { env ->
                service.updateStageNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("createSubprocessNode") { env ->
                service.createSubprocessNode(env.getArgument("processId"), inputArgument(env))
            }
            type.dataFetcher("updateSubprocessNode") { env ->
                service.updateSubprocessNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("reorderSubprocessStages") { env ->
                service.reorderSubprocessStages(
                    env.getArgument("subprocessId"),
                    requiredArgument(env, "stageIds")
                )
            }
            type.dataFetcher("deleteSubprocessNode") { env ->
                service.deleteSubprocessNode(env.getArgument("id"))
            }
            type.dataFetcher("createStageNode") { env ->
                service.createStageNode(env.getArgument("subprocessId"), inputArgument(env))
            }
            type.dataFetcher("deleteStageNode") { env ->
                service.deleteStageNode(env.getArgument("id"))
            }
            type.dataFetcher("createConfiguratorNode") { env ->
                service.createConfiguratorNode(env.getArgument("stageId"), inputArgument(env))
            }
            type.dataFetcher("updateConfiguratorNode") { env ->
                service.updateConfiguratorNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("deleteConfiguratorNode") { env ->
                service.deleteConfiguratorNode(env.getArgument("id"))
            }
            type.dataFetcher("createResultNode") { env ->
                service.createResultNode(env.getArgument("configuratorId"), inputArgument(env))
            }
            type.dataFetcher("updateResultNode") { env ->
                service.updateResultNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("deleteResultNode") { env ->
                service.deleteResultNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseNode") { env ->
                service.createReverseNode(env.getArgument("resultId"), inputArgument(env))
            }
            type.dataFetcher("updateReverseNode") { env ->
                service.updateReverseNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("reorderReverseOutputs") { env ->
                service.reorderReverseOutputs(
                    env.getArgument("reverseId"),
                    requiredArgument(env, "outputIds")
                )
            }
            type.dataFetcher("deleteReverseNode") { env ->
                service.deleteReverseNode(env.getArgument("id"))
            }
            type.dataFetcher("createReverseOutputNode") { env ->
                service.createReverseOutputNode(env.getArgument("reverseId"), inputArgument(env))
            }
            type.dataFetcher("updateReverseOutputNode") { env ->
                service.updateReverseOutputNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("deleteReverseOutputNode") { env ->
                service.deleteReverseOutputNode(env.getArgument("id"))
            }
            type.dataFetcher("updateProcessNode") { env ->
                service.updateProcessNode(env.getArgument("id"), inputArgument(env))
            }
            type.dataFetcher("renameContextCodesDictionary") { env ->
                service.renameContextCodesDictionary(env.getArgument("id"), requiredArgument(env, "code"))
            }
            type
        }
    }

    private fun inputArgument(env: DataFetchingEnvironment): Map<String, Any?> =
        requiredArgument(env, "input")

    private fun <T : Any> requiredArgument(env: DataFetchingEnvironment, name: String): T =
        env.getArgument<T>(name) ?: error("GraphQL argument '$name' is required")
}
