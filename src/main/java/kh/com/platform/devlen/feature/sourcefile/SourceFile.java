package kh.com.platform.devlen.feature.sourcefile;

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
@Table(name = "source_files", uniqueConstraints = {
        @UniqueConstraint(name = "uq_source_files_path", columnNames = {"scan_id", "relative_path"})
})
@Check(constraints = "size_bytes >= 0")
public class SourceFile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ScanRun scanRun;

    @Column(name = "relative_path", nullable = false, columnDefinition = "TEXT")
    private String relativePath;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "extension", length = 30)
    private String extension;

    @Column(name = "language", length = 80)
    private String language;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "content_hash", length = 64)
    private String contentHash;
}
