import { useCallback, useState } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from "reactflow";
import "reactflow/dist/style.css";

import Layout from "./Layout";

import RouterNode from "./RouterNode"; // import custom node
import routerIcon from "./assets/router.png"; // import PNG
import switchIcon from "./assets/switch.png"; // import PNG
import Background2 from "./assets/server_rack.png";

const initialNodes = [
  {
    id: "1",
    type: "router",
    position: { x: 0, y: 0 },
    data: { label: "Router 1", icon: routerIcon },
  },
  {
    id: "2",
    type: "router",
    position: { x: 100, y: 100 },
    data: { label: "Router 2", icon: routerIcon },
  },
  {
    id: "3",
    type: "switch",
    position: { x: 200, y: 200 },
    data: { label: "Switch 1", icon: switchIcon },
  },
  {
    id: "4",
    position: { x: 200, y: 100 },
    data: { label: "TESTOWY" },
  },
];

const initialEdges = [];

const nodeTypes = {
  router: RouterNode,
  switch: RouterNode,
};

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [sourceNode, setSourceNode] = useState(null);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      if (!sourceNode) {
        setSourceNode(node);
      } else if (sourceNode.id !== node.id) {
        setEdges((eds) =>
          addEdge(
            {
              id: `${sourceNode.id}-${node.id}`,
              source: sourceNode.id,
              target: node.id,
              animated: true,
            },
            eds
          )
        );
        setSourceNode(null);
      } else {
        setSourceNode(null);
      }
    },
    [sourceNode, setEdges]
  );

  // 🔥 funkcja dodająca nowy router
  const addRouter = () => {
    setNodes((nds) => [
      ...nds,
      {
        id: (nds.length + 1).toString(), // unikalne ID
        type: "router",
        position: { x: Math.random() * 400, y: Math.random() * 400 }, // losowa pozycja
        data: { label: `Router ${nds.length + 1}`, icon: routerIcon },
      },
    ]);
  };

    // 🔥 Funkcja zapisująca layout
  const saveLayout = async () => {
    const layout = { nodes, edges };

    try {
      const res = await fetch("http://192.168.0.150:5000/saveLayout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });

      const data = await res.json();
      console.log("Saved:", data);
      alert("Layout zapisany w bazie!");
    } catch (err) {
      console.error("Błąd zapisu layoutu:", err);
      alert("Nie udało się zapisać layoutu");
    }
  };

  const loadLayoutById = async (layoutId) => {
  try {
    const res = await fetch(`http://localhost:5000/getLayout/${layoutId}`);
    if (!res.ok) throw new Error("Błąd pobierania layoutu");

    const data = await res.json();
    console.log("Pobrany layout:", data);

    if (data.nodes && data.edges) {
      setNodes(data.nodes);
      setEdges(data.edges);
    }
  } catch (err) {
    console.error("Błąd wczytywania layoutu:", err);
    alert("Nie udało się wczytać layoutu");
  }
};

  const nodesWithSetters = nodes.map((n) =>
    n.type === "router" ? { ...n, data: { ...n.data, setNodes } } : n
  );

  return (
    // <Layout>
      // <h1 style={{ color: "#031322" }}>Mapa podłączeń</h1>
      
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* 🔘 Przycisk do dodawania routerów */}
       <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10 }}>
        <button onClick={addRouter} style={{ marginRight: 8 }}>
          ➕ Dodaj Router
        </button>
        <button onClick={saveLayout} style={{ background: "green", color: "white" }}>
          💾 Zapisz Layout
        </button>
        <button 
  onClick={() => loadLayoutById(1)}   // 👈 teraz wywoła się dopiero po kliknięciu
  style={{ marginLeft: 8, background: "orange", color: "white" }}
>
  📂 Wczytaj Layout
</button>
      </div>

      {/* Obrazek jako tło */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${Background2})`,
          backgroundSize: "800px 800px",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />

      {/* ReactFlow */}
      <ReactFlow
        nodes={nodesWithSetters}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}saveLayout
        onConnect={onConnect}
        fitView
        onEdgesDelete={(deleted) =>setEdges((eds) => eds.filter((e) => !deleted.some((d) => d.id === e.id)))}
        nodeTypes={nodeTypes}
        style={{ zIndex: 1 }}
      >
        <MiniMap />
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
    // </Layout>
  );
}

export default Flow;
