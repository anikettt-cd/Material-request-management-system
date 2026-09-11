

CREATE DATABASE IF NOT EXISTS `viraj_mdm_db`;
USE `viraj_mdm_db`;

--
-- Table structure for table `users`
--
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `plant_id` varchar(255) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `material_requests`
--
DROP TABLE IF EXISTS `material_requests`;
CREATE TABLE `material_requests` (
  `request_id` int NOT NULL AUTO_INCREMENT,
  `material_type` varchar(10) NOT NULL,
  `plant_id` varchar(10) NOT NULL,
  `storage_location` varchar(10) NOT NULL,
  `sales_org` varchar(10) DEFAULT NULL,
  `dist_channel` varchar(10) DEFAULT NULL,
  `material_description` varchar(40) NOT NULL,
  `base_unit_of_measure` varchar(10) NOT NULL,
  `material_group` varchar(20) NOT NULL,
  `control_code_gst` varchar(20) DEFAULT NULL,
  `purchasing_group` varchar(10) DEFAULT NULL,
  `valuation_category` varchar(10) DEFAULT NULL,
  `valuation_class` varchar(10) DEFAULT NULL,
  `created_by` int NOT NULL,
  `status` varchar(20) DEFAULT 'Pending',
  `current_stage` varchar(30) DEFAULT 'Plant_Head',
  `generated_material_code` varchar(30) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `latest_note` text,
  `return_to_stage` varchar(50) DEFAULT NULL,
  `long_description` text,
  PRIMARY KEY (`request_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `material_requests_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `workflow_logs`
--
DROP TABLE IF EXISTS `workflow_logs`;
CREATE TABLE `workflow_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `request_id` int DEFAULT NULL,
  `action_by` int DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `action_type` varchar(50) DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `comments` text,
  `changes_diff` json DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `ix_workflow_logs_log_id` (`log_id`),
  KEY `ix_workflow_logs_request_id` (`request_id`),
  CONSTRAINT `workflow_logs_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `material_requests` (`request_id`),
  CONSTRAINT `workflow_logs_ibfk_2` FOREIGN KEY (`action_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `master_data_library`
--
DROP TABLE IF EXISTS `master_data_library`;
CREATE TABLE `master_data_library` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_code` varchar(50) NOT NULL,
  `material_description` varchar(255) NOT NULL,
  `UOM` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `material_code` (`material_code`),
  KEY `idx_mat_desc` (`material_description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;