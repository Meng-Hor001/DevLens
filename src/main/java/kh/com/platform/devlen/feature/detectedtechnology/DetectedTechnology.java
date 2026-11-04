package kh.com.platform.devlen.feature.detectedtechnology;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.*;
import java.util.UUID;
import kh.com.platform.devlen.feature.scanrun.ScanRun;
import java.math.BigDecimal;
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "detected_technologies")
@Check(constraints = "confidence IS NULL OR confidence BETWEEN 0 AND 1")
public class DetectedTechnology {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ScanRun scanRun;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private TechnologyCategory category;

    @Column(name = "detected_version", length = 80)
    private String detectedVersion;

    @Column(name = "confidence", precision = 5, scale = 4)
    private BigDecimal confidence;

    @Column(name = "evidence_path", columnDefinition = "TEXT")
    private String evidencePath;
}
