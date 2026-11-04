package kh.com.platform.devlen.feature.dependency;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.*;
import java.util.UUID;
import kh.com.platform.devlen.feature.scanrun.ScanRun;
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "dependencies", uniqueConstraints = {
        @UniqueConstraint(name = "uq_dependencies_manifest_package", columnNames = {"scan_id", "manifest_path", "name", "dependency_type"})
})
public class Dependency {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ScanRun scanRun;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "version_spec", length = 150)
    private String versionSpec;

    @Enumerated(EnumType.STRING)
    @Column(name = "ecosystem", nullable = false, length = 40)
    private Ecosystem ecosystem = Ecosystem.NPM;

    @Enumerated(EnumType.STRING)
    @Column(name = "dependency_type", nullable = false, length = 40)
    private DependencyType dependencyType;

    @Column(name = "manifest_path", nullable = false, columnDefinition = "TEXT")
    private String manifestPath;
}
