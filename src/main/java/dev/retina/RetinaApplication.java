package dev.retina;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts the Retina control plane without enabling unfinished external integrations. */
@SpringBootApplication
public class RetinaApplication {

    public static void main(String[] args) {
        SpringApplication.run(RetinaApplication.class, args);
    }
}
