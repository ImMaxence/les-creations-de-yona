package fr.lescreationsdeyona;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class YonaApplication {

	public static void main(String[] args) {
		SpringApplication.run(YonaApplication.class, args);
	}

}
