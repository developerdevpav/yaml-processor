package com.sber.yamlprocessor.controller;

import com.sber.yamlprocessor.model.ProcessConfig;
import com.sber.yamlprocessor.service.ProcessConfigService;
import com.sber.yamlprocessor.service.YamlFileService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.util.List;

@Controller
@RequestMapping("/yaml")
public class YamlController {

    @Autowired
    private YamlFileService yamlFileService;

    @Autowired
    private ProcessConfigService processConfigService;

    @GetMapping
    public String listYamlFiles(Model model) {
        try {
            List<String> files = yamlFileService.getAllYamlFiles();
            model.addAttribute("files", files);
        } catch (IOException e) {
            model.addAttribute("error", "Ошибка при получении списка файлов: " + e.getMessage());
        }
        return "yaml/list";
    }

    @GetMapping("/new")
    public String newYamlFile(Model model) {
        ProcessConfig config = processConfigService.createSampleProcessConfig();
        model.addAttribute("processConfig", config);
        return "yaml/edit";
    }

    @GetMapping("/edit/{filename}")
    public String editYamlFile(@PathVariable String filename, Model model) {
        try {
            ProcessConfig config = yamlFileService.loadYamlFile(filename);
            model.addAttribute("processConfig", config);
            model.addAttribute("filename", filename);
            return "yaml/edit";
        } catch (IOException e) {
            model.addAttribute("error", "Ошибка при загрузке файла: " + e.getMessage());
            return "redirect:/yaml";
        }
    }

    @PostMapping("/save")
    public String saveYamlFile(@RequestParam(required = false) String filename,
                              @Valid @ModelAttribute ProcessConfig processConfig,
                              BindingResult bindingResult,
                              RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            return "yaml/edit";
        }

        try {
            if (filename == null || filename.trim().isEmpty()) {
                filename = "process_" + System.currentTimeMillis() + ".yml";
            }
            
            if (!filename.endsWith(".yml") && !filename.endsWith(".yaml")) {
                filename += ".yml";
            }

            ProcessConfig validatedConfig = processConfigService.validateProcessConfig(processConfig);
            yamlFileService.saveYamlFile(filename, validatedConfig);
            
            redirectAttributes.addFlashAttribute("success", "Файл успешно сохранен: " + filename);
            return "redirect:/yaml";
        } catch (IOException e) {
            redirectAttributes.addFlashAttribute("error", "Ошибка при сохранении файла: " + e.getMessage());
            return "yaml/edit";
        }
    }

    @PostMapping("/delete/{filename}")
    public String deleteYamlFile(@PathVariable String filename, RedirectAttributes redirectAttributes) {
        try {
            yamlFileService.deleteYamlFile(filename);
            redirectAttributes.addFlashAttribute("success", "Файл успешно удален: " + filename);
        } catch (IOException e) {
            redirectAttributes.addFlashAttribute("error", "Ошибка при удалении файла: " + e.getMessage());
        }
        return "redirect:/yaml";
    }

    @GetMapping("/view/{filename}")
    public String viewYamlFile(@PathVariable String filename, Model model) {
        try {
            ProcessConfig config = yamlFileService.loadYamlFile(filename);
            model.addAttribute("processConfig", config);
            model.addAttribute("filename", filename);
            return "yaml/view";
        } catch (IOException e) {
            model.addAttribute("error", "Ошибка при загрузке файла: " + e.getMessage());
            return "redirect:/yaml";
        }
    }
}
