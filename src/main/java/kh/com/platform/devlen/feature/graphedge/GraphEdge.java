package kh.com.platform.devlen.feature.graphedge;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.*;
import java.util.UUID;
import kh.com.platform.devlen.feature.scanrun.ScanRun;
import kh.com.platform.devlen.feature.graphnode.GraphNode;
import java.util.Map;
import java.util.HashMap;
import org.hibernate.type.SqlTypes;
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "graph_edges", uniqueConstraints = {
        @UniqueConstraint(name = "uq_graph_edges_relation", columnNames = {"scan_id", "source_node_id", "target_node_id", "edge_type"})
})
@Check(constraints = "jsonb_typeof(metadata) = 'object'")
public class GraphEdge {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scan_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private ScanRun scanRun;

    @Column(name = "source_node_id", nullable = false)
    private UUID sourceNodeId;

    @Column(name = "target_node_id", nullable = false)
    private UUID targetNodeId;

    // UUID fields own writes; this composite association enforces scan consistency.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns({
        @JoinColumn(name = "scan_id", referencedColumnName = "scan_id", insertable = false, updatable = false),
        @JoinColumn(name = "source_node_id", referencedColumnName = "id", insertable = false, updatable = false)
    })
    @OnDelete(action = OnDeleteAction.CASCADE)
    @Setter(lombok.AccessLevel.NONE)
    private GraphNode sourceNode;

    // UUID fields own writes; this composite association enforces scan consistency.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumns({
        @JoinColumn(name = "scan_id", referencedColumnName = "scan_id", insertable = false, updatable = false),
        @JoinColumn(name = "target_node_id", referencedColumnName = "id", insertable = false, updatable = false)
    })
    @OnDelete(action = OnDeleteAction.CASCADE)
    @Setter(lombok.AccessLevel.NONE)
    private GraphNode targetNode;

    @Enumerated(EnumType.STRING)
    @Column(name = "edge_type", nullable = false, length = 40)
    private EdgeType edgeType;

    @JdbcTypeCode(SqlTypes.JSON)
    @ColumnDefault("'{}'::jsonb")
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> metadata = new HashMap<>();
}
