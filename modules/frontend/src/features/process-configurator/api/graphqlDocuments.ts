import { gql } from '@apollo/client';

export const PROCESS_FIELDS = gql`
  fragment ReverseOutputFields on ReverseOutput {
    id
    name
    rule
    phase {
      code
    }
    body {
      type
      eventObject {
        type
      }
      service {
        scenario
        type
        status {
          code
        }
        sla {
          durationValue
          durationUnit {
            code
          }
          status {
            code
          }
        }
      }
    }
    log {
      journalServiceName
      message
    }
    parent {
      include
      mode
    }
  }

  fragment ReverseFields on Reverse {
    id
    status {
      code
    }
    output {
      ...ReverseOutputFields
    }
  }

  fragment ResultFields on Result {
    id
    inputScenarios
    reverse {
      ...ReverseFields
    }
  }

  fragment ConfiguratorFields on Configurator {
    id
    disabled
    interrupted
    multiple
    filterEventRule
    audit {
      enabled
      eventCode
      eventDescription
    }
    result {
      ...ResultFields
    }
  }

  fragment StageFields on Stage {
    id
    nodeName
    nodeComment
    executor
    contextCode {
      code
    }
    log {
      journalServiceName
    }
    configurator {
      ...ConfiguratorFields
    }
  }

  fragment SubprocessFields on Subprocess {
    id
    nodeName
    nodeComment
    disabled
    trigger {
      rule
    }
    stages {
      ...StageFields
    }
  }

  query ProcessConfigList {
    actionPhasesDictionaryList {
      code
    }
    b3StatusDictionaryList {
      code
    }
    slaDurationUnitDictionaryList {
      code
    }
    slaStatusDictionaryList {
      code
    }
    contextCodesDictionaryList {
      code
    }
    processConfigList {
      id
      createdAt
      updatedAt
      process {
        id
        nodeName
        nodeComment
        disabled
        contextCode {
          code
        }
        subprocess {
          ...SubprocessFields
        }
      }
    }
  }
`;

export const CREATE_PROCESS = gql`
  mutation CreateProcessConfig($input: ProcessConfigInput!) {
    createProcessConfig(input: $input) {
      id
      process {
        id
        nodeName
        nodeComment
        disabled
        contextCode {
          code
        }
        subprocess {
          id
          nodeName
          nodeComment
          disabled
          trigger {
            rule
          }
          stages {
            id
          }
        }
      }
    }
  }
`;

export const UPDATE_PROCESS = gql`
  mutation UpdateProcessConfig($id: ID!, $input: ProcessConfigInput!) {
    updateProcessConfig(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_PROCESS_CONFIG = gql`
  mutation DeleteProcessConfig($id: ID!) {
    deleteProcessConfig(id: $id)
  }
`;

export const CREATE_CONTEXT_CODE = gql`
  mutation CreateContextCode($code: ID!) {
    createContextCodesDictionary(input: { code: $code }) {
      code
    }
  }
`;

export const RENAME_CONTEXT_CODE = gql`
  mutation RenameContextCode($id: ID!, $code: String!) {
    renameContextCodesDictionary(id: $id, code: $code) {
      code
    }
  }
`;

export const DELETE_CONTEXT_CODE = gql`
  mutation DeleteContextCode($id: ID!) {
    deleteContextCodesDictionary(id: $id)
  }
`;

export const UPDATE_STAGE_NODE = gql`
  mutation UpdateStageNode($id: ID!, $input: StageInput!) {
    updateStageNode(id: $id, input: $input) {
      id
    }
  }
`;

export const UPDATE_CONFIGURATOR_NODE = gql`
  mutation UpdateConfiguratorNode($id: ID!, $input: ConfiguratorInput!) {
    updateConfiguratorNode(id: $id, input: $input) {
      id
    }
  }
`;

export const UPDATE_SUBPROCESS_NODE = gql`
  mutation UpdateSubprocessNode($id: ID!, $input: SubprocessInput!) {
    updateSubprocessNode(id: $id, input: $input) {
      id
    }
  }
`;

export const REORDER_SUBPROCESS_STAGES = gql`
  mutation ReorderSubprocessStages($subprocessId: ID!, $stageIds: [ID!]!) {
    reorderSubprocessStages(subprocessId: $subprocessId, stageIds: $stageIds) {
      id
    }
  }
`;

export const REORDER_REVERSE_OUTPUTS = gql`
  mutation ReorderReverseOutputs($reverseId: ID!, $outputIds: [ID!]!) {
    reorderReverseOutputs(reverseId: $reverseId, outputIds: $outputIds) {
      id
    }
  }
`;

export const UPDATE_PROCESS_NODE = gql`
  mutation UpdateProcessNode($id: ID!, $input: ProcessInput!) {
    updateProcessNode(id: $id, input: $input) {
      id
      nodeName
      nodeComment
      contextCode {
        code
      }
    }
  }
`;

export const CREATE_SUBPROCESS_NODE = gql`
  mutation CreateSubprocessNode($processId: ID!, $input: SubprocessInput!) {
    createSubprocessNode(processId: $processId, input: $input) {
      id
    }
  }
`;

export const CREATE_RESULT_NODE = gql`
  mutation CreateResultNode($configuratorId: ID!, $input: ResultInput!) {
    createResultNode(configuratorId: $configuratorId, input: $input) {
      id
      inputScenarios
      reverse {
        id
        status {
          code
        }
      }
    }
  }
`;

export const CREATE_REVERSE_NODE = gql`
  mutation CreateReverseNode($resultId: ID!, $input: ReverseInput!) {
    createReverseNode(resultId: $resultId, input: $input) {
      id
      status {
        code
      }
    }
  }
`;

export const UPDATE_REVERSE_NODE = gql`
  mutation UpdateReverseNode($id: ID!, $input: ReverseInput!) {
    updateReverseNode(id: $id, input: $input) {
      id
    }
  }
`;

export const UPDATE_RESULT_NODE = gql`
  mutation UpdateResultNode($id: ID!, $input: ResultInput!) {
    updateResultNode(id: $id, input: $input) {
      id
    }
  }
`;

export const CREATE_REVERSE_OUTPUT_NODE = gql`
  mutation CreateReverseOutputNode($reverseId: ID!, $input: ReverseOutputInput!) {
    createReverseOutputNode(reverseId: $reverseId, input: $input) {
      id
      name
      rule
    }
  }
`;

export const UPDATE_REVERSE_OUTPUT_NODE = gql`
  mutation UpdateReverseOutputNode($id: ID!, $input: ReverseOutputInput!) {
    updateReverseOutputNode(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_SUBPROCESS_NODE = gql`
  mutation DeleteSubprocessNode($id: ID!) {
    deleteSubprocessNode(id: $id)
  }
`;

export const CREATE_STAGE_NODE = gql`
  mutation CreateStageNode($subprocessId: ID!, $input: StageInput!) {
    createStageNode(subprocessId: $subprocessId, input: $input) {
      id
    }
  }
`;

export const DELETE_STAGE_NODE = gql`
  mutation DeleteStageNode($id: ID!) {
    deleteStageNode(id: $id)
  }
`;

export const DELETE_CONFIGURATOR_NODE = gql`
  mutation DeleteConfiguratorNode($id: ID!) {
    deleteConfiguratorNode(id: $id)
  }
`;

export const DELETE_RESULT_NODE = gql`
  mutation DeleteResultNode($id: ID!) {
    deleteResultNode(id: $id)
  }
`;

export const DELETE_REVERSE_NODE = gql`
  mutation DeleteReverseNode($id: ID!) {
    deleteReverseNode(id: $id)
  }
`;

export const DELETE_REVERSE_OUTPUT_NODE = gql`
  mutation DeleteReverseOutputNode($id: ID!) {
    deleteReverseOutputNode(id: $id)
  }
`;
