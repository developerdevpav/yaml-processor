export type EntityId = string;

export interface DictionaryReference {
  code: string;
}

export interface ProcessConfig {
  id?: EntityId;
  createdAt?: string;
  updatedAt?: string;
  process?: ProcessNode | null;
}

export interface ProcessNode {
  id?: EntityId;
  nodeName?: string;
  nodeComment?: string;
  disabled?: boolean;
  contextCode?: DictionaryReference | null;
  subprocess?: SubprocessNode[];
}

export interface SubprocessNode {
  id?: EntityId;
  nodeName?: string;
  nodeComment?: string;
  disabled?: boolean;
  trigger?: {
    rule?: string;
  } | null;
  stages?: StageNode[];
}

export interface StageNode {
  id?: EntityId;
  executor?: string;
  contextCode?: DictionaryReference | null;
  nodeName?: string;
  nodeComment?: string;
  log?: {
    journalServiceName?: string;
  } | null;
  configurator?: ConfiguratorNode | null;
}

export interface ConfiguratorNode {
  id?: EntityId;
  disabled?: boolean;
  interrupted?: boolean;
  multiple?: boolean;
  filterEventRule?: string;
  audit?: {
    enabled?: boolean;
    eventCode?: string;
    eventDescription?: string;
  } | null;
  result?: ResultNode[];
}

export interface ResultNode {
  id?: EntityId;
  inputScenarios?: string[];
  reverse?: ReverseNode[];
}

export interface ReverseNode {
  id?: EntityId;
  status?: DictionaryReference | null;
  output?: ReverseOutputNode[];
}

export interface ReverseOutputNode {
  id?: EntityId;
  phase?: DictionaryReference | null;
  name?: string;
  rule?: string;
  body?: {
    type?: string;
    eventObject?: {
      type?: string;
    } | null;
    service?: {
      scenario?: string;
      type?: string;
      status?: DictionaryReference | null;
      sla?: {
        durationValue?: number | null;
        durationUnit?: DictionaryReference | null;
        status?: DictionaryReference | null;
      } | null;
    } | null;
  } | null;
  log?: {
    journalServiceName?: string;
    message?: string;
  } | null;
  parent?: {
    include?: boolean;
    mode?: string;
  } | null;
}

export type ProcessNodeKind = 'process' | 'subprocess' | 'stage' | 'result' | 'reverse' | 'reverseOutput';

export interface SelectedProcessNode {
  kind: ProcessNodeKind;
  node: ProcessNode | SubprocessNode | StageNode | ResultNode | ReverseNode | ReverseOutputNode;
}
