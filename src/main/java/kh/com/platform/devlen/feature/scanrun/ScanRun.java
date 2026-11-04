package kh.com.platform.devlen.feature.scanrun;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.*;
import java.util.UUID;
import java.time.ZonedDateTime;
import kh.com.platform.devlen.feature.project.Project;
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "scan_runs")
@Check(constraints = "total_files >= 0 AND total_bytes >= 0 AND (duration_ms IS NULL OR duration_ms >= 0) AND (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)")
public class ScanRun {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Project project;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ScanStatus status = ScanStatus.PENDING;

    @Column(name = "total_files", nullable = false)
    private int totalFiles;

    @Column(name = "total_bytes", nullable = false)
    private long totalBytes;

    @Column(name = "started_at")
    private ZonedDateTime startedAt;

    @Column(name = "completed_at")
    private ZonedDateTime completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private ZonedDateTime createdAt;
}
