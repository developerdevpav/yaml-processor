package com.sber.yamlprocessor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    
    private Yaml yaml = new Yaml();
    
    public static class Yaml {
        private String directory = "./yaml-files";
        private String schemaFile = "./schema.json";
        
        public String getDirectory() {
            return directory;
        }
        
        public void setDirectory(String directory) {
            this.directory = directory;
        }
        
        public String getSchemaFile() {
            return schemaFile;
        }
        
        public void setSchemaFile(String schemaFile) {
            this.schemaFile = schemaFile;
        }
    }
    
    public Yaml getYaml() {
        return yaml;
    }
    
    public void setYaml(Yaml yaml) {
        this.yaml = yaml;
    }
}
