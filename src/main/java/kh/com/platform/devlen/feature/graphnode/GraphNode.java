package kh.com.platform.devlen.feature.graphnode;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.*;
import java.util.UUID;
import kh.com.platform.devlen.feature.scanrun.ScanRun;
import java.util.Map;
import java.util.HashMap;
import org.hibernate.type.SqlTypes;
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "graph_nodes", uniqueConstraints = {
        @UniqueConstraint(name = "uq_graph_nodes_key", columnNames = {"scan_id", "node_key"}),
        @UniqueConstraint(name = "uq_graph_nodes_scan_id", columnNames = {"scan_id", "id"})
})
@Check(constraints = "jsonb_typeof(metadata) = 'object'")
public class GraphNode {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ScanRun scanRun;

    @Column(name = "node_key", nullable = false, columnDefinition = "TEXT")
    private String nodeKey;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "node_type", nullable = false, length = 50)
    private NodeType nodeType;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @JdbcTypeCode(SqlTypes.JSON)
    @ColumnDefault("'{}'::jsonb")
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();
}
