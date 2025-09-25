package com.sber.yamlprocessor.service;

import com.sber.yamlprocessor.model.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ProcessConfigService {

    @Autowired
    private YamlFileService yamlFileService;

    public ProcessConfig createSampleProcessConfig() {
        ProcessConfig config = new ProcessConfig();
        
        com.sber.yamlprocessor.model.Process process = new com.sber.yamlprocessor.model.Process();
        process.setDescription("Пример процесса");
        process.setId("sample-process-1");
        process.setContextCode(ContextCodes.PSPLUS);
        process.setDisabled(false);
        
        List<Subprocess> subprocesses = new ArrayList<>();
        
        // Создаем подпроцесс
        Subprocess subprocess = new Subprocess();
        subprocess.setId("subprocess-1");
        subprocess.setDescription("Пример подпроцесса");
        subprocess.setContextCode(ContextCodes.PSPLUS);
        subprocess.setDisabled(false);
        
        // Создаем триггер
        Trigger trigger = new Trigger();
        trigger.setRule("event.type == 'PROCESS_START'");
        subprocess.setTrigger(trigger);
        
        // Создаем стадии
        List<Stage> stages = new ArrayList<>();
        
        Stage stage1 = new Stage();
        stage1.setId(true);
        stage1.setExecutor("SampleExecutor");
        stage1.setDescription("Первая стадия");
        stage1.setContextCode(ContextCodes.PSPLUS);
        
        // Создаем лог для стадии
        Log log = new Log();
        log.setJournalServiceName("sample-journal-service");
        stage1.setLog(log);
        
        // Создаем конфигуратор
        Configurator configurator = new Configurator();
        configurator.setFilterEventRule("event.status == 'ACTIVE'");
        configurator.setDisabled(false);
        configurator.setInterrupted(true);
        configurator.setMultiple(false);
        
        // Создаем аудит
        Audit audit = new Audit();
        audit.setEnabled(true);
        audit.setEventCode("AUDIT_001");
        audit.setEventDescription("Аудит первой стадии");
        configurator.setAudit(audit);
        
        // Создаем результат
        List<Result> results = new ArrayList<>();
        Result result = new Result();
        result.setInputScenarios(List.of("scenario1", "scenario2"));
        
        // Создаем reverse
        List<Reverse> reverses = new ArrayList<>();
        Reverse reverse = new Reverse();
        reverse.setStatus(B3Status.ACCEPTED);
        
        // Создаем reverse output
        List<ReverseOutput> outputs = new ArrayList<>();
        ReverseOutput output = new ReverseOutput();
        output.setPhase(ActionPhases.START);
        output.setName("output1");
        output.setRule("output.rule == 'SUCCESS'");
        
        // Создаем body
        Body body = new Body();
        body.setType("process_event");
        
        EventObject eventObject = new EventObject();
        eventObject.setType("business_event");
        body.setEventObject(eventObject);
        
        com.sber.yamlprocessor.model.Service service = new com.sber.yamlprocessor.model.Service();
        service.setScenario("main_scenario");
        service.setStatus("active");
        
        SlaState sla = new SlaState();
        sla.setStatus(SlaStatus.STARTED);
        sla.setDurationValue(30);
        sla.setDurationUnit(SlaDurationUnit.MINUTES);
        service.setSla(sla);
        
        body.setService(service);
        output.setBody(body);
        
        // Создаем event log
        EventLog eventLog = new EventLog();
        eventLog.setJournalServiceName("event-journal-service");
        eventLog.setMessage("Обработка события");
        output.setLog(eventLog);
        
        outputs.add(output);
        reverse.setOutput(outputs);
        reverses.add(reverse);
        result.setReverse(reverses);
        results.add(result);
        configurator.setResult(results);
        
        stage1.setConfigurator(configurator);
        stages.add(stage1);
        
        subprocess.setStages(stages);
        subprocesses.add(subprocess);
        
        process.setSubprocess(subprocesses);
        config.setProcess(process);
        
        return config;
    }

    public ProcessConfig validateProcessConfig(ProcessConfig config) {
        // Здесь можно добавить дополнительную валидацию
        return config;
    }
}
