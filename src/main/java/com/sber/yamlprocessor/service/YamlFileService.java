package com.sber.yamlprocessor.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sber.yamlprocessor.config.AppProperties;
import com.sber.yamlprocessor.model.ProcessConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

@Service
public class YamlFileService {

    @Autowired
    private ObjectMapper yamlObjectMapper;

    @Autowired
    private AppProperties appProperties;

    public List<String> getAllYamlFiles() throws IOException {
        Path yamlDirectory = Paths.get(appProperties.getYaml().getDirectory());
        
        if (!Files.exists(yamlDirectory)) {
            Files.createDirectories(yamlDirectory);
            return new ArrayList<>();
        }

        try (Stream<Path> paths = Files.walk(yamlDirectory)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".yml") || path.toString().endsWith(".yaml"))
                    .map(path -> path.getFileName().toString())
                    .sorted()
                    .toList();
        }
    }

    public ProcessConfig loadYamlFile(String filename) throws IOException {
        Path filePath = Paths.get(appProperties.getYaml().getDirectory(), filename);
        
        if (!Files.exists(filePath)) {
            throw new IOException("Файл не найден: " + filename);
        }

        return yamlObjectMapper.readValue(filePath.toFile(), ProcessConfig.class);
    }

    public void saveYamlFile(String filename, ProcessConfig processConfig) throws IOException {
        Path yamlDirectory = Paths.get(appProperties.getYaml().getDirectory());
        
        if (!Files.exists(yamlDirectory)) {
            Files.createDirectories(yamlDirectory);
        }

        Path filePath = yamlDirectory.resolve(filename);
        yamlObjectMapper.writeValue(filePath.toFile(), processConfig);
    }

    public void deleteYamlFile(String filename) throws IOException {
        Path filePath = Paths.get(appProperties.getYaml().getDirectory(), filename);
        
        if (!Files.exists(filePath)) {
            throw new IOException("Файл не найден: " + filename);
        }

        Files.delete(filePath);
    }

    public boolean fileExists(String filename) {
        Path filePath = Paths.get(appProperties.getYaml().getDirectory(), filename);
        return Files.exists(filePath);
    }

    public ProcessConfig createEmptyProcessConfig() {
        return new ProcessConfig();
    }
}
