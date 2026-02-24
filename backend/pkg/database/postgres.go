package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewPostgres opens a GORM connection to PostgreSQL and auto-migrates all models.
func NewPostgres(dsn string, logLevel string) (*gorm.DB, error) {
	level := logger.Warn
	if logLevel == "debug" {
		level = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(level),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)

	// Enable pgvector extension
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS vector").Error; err != nil {
		return nil, fmt.Errorf("enable pgvector: %w", err)
	}

	// Auto-migrate all models
	if err := db.AutoMigrate(
		&User{},
		&Project{},
		&Flow{},
		&Task{},
		&Action{},
		&Artifact{},
		&Session{},
		&MemoryRecord{},
		&ApprovalRequest{},
	); err != nil {
		return nil, fmt.Errorf("auto-migrate: %w", err)
	}

	return db, nil
}
