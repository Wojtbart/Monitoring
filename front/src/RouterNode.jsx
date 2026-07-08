// import { useCallback } from "react";
// import { Handle, Position } from "reactflow"; // 👈 import Handle

// function RouterNode({ id, data }) {
//   const handleChange = useCallback(
//     (evt) => {
//       const newLabel = evt.target.value;

//       if (data.setNodes) {
//         data.setNodes((nds) =>
//           nds.map((n) =>
//             n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
//           )
//         );
//       }
//     },
//     [id, data]
//   );

//   return (
//     <div style={{ textAlign: "center", position: "relative" }}>
//       {/* Incoming edges */}
//       {/* <Handle type="target" position={Position.Top} /> */}

//       <img src={data.icon} alt="router" style={{ width: 30, height: 30 }} />

//       <input
//         type="text"
//         value={data.label}
//         onChange={handleChange}
//         style={{
//           marginTop: 4,
//           fontSize: 12,
//           // display: "block",
//           border: "1px solid #ccc",
//           borderRadius: 4,
//           textAlign: "center",
//         }}
//       />

//       {/* Outgoing edges */}

//       {/* One handle only */}
//       <Handle
//         type="source"
//         position={Position.Bottom}
//         isConnectable={true}
//         id="a" // give it an id (can be reused as target)
//         style={{ background: "#555" }}
//       />    </div>
//   );
// }

import { useCallback } from "react";
import { Handle, Position } from "reactflow";

function RouterNode({ id, data }) {
  const handleChange = useCallback(
    (evt) => {
      const newLabel = evt.target.value;

      if (data.setNodes) {
        data.setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
          )
        );
      }
    },
    [id, data]
  );

  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      {/* 🔌 Target (wejście) */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"   // <-- musi mieć unikalny id
        style={{ background: "#555" }}
      />

      {/* ikona */}
      <img src={data.icon} alt="router" style={{ width: 30, height: 30 }} />

      {/* label edytowalny */}
      <input
        type="text"
        value={data.label}
        onChange={handleChange}
        style={{
          marginTop: 4,
          fontSize: 12,
          border: "1px solid #ccc",
          borderRadius: 4,
          textAlign: "center",
        }}
      />

      {/* 🔌 Source (wyjście) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"   // <-- też musi mieć id
        style={{ background: "#555" }}
      />
    </div>
  );
}

export default RouterNode;
