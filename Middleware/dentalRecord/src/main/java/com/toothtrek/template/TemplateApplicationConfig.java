package com.toothtrek.template;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TemplateApplicationConfig {
    @Bean
    public ExecutorService executorService() {
        return Executors.newCachedThreadPool();
    }
}
