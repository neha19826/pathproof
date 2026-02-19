# PathProof  
## Graph-Based Financial Crime Detection Engine

**PathProof** is a web-based financial forensics application that detects money muling networks using graph theory and transaction analysis.

Traditional database queries fail to detect multi-hop laundering patterns. PathProof converts transaction data into a directed graph and identifies suspicious accounts, fraud rings, and high-risk transaction flows through structural network analysis.

**Live Application:**  
https://pathproof.vercel.app/

---

## Problem Statement

Money muling is a financial crime in which illicit funds are transferred across multiple accounts to hide the original source.

Key challenges:

- Multi-hop transfers conceal fund origin  
- Circular transaction loops obscure detection  
- Distributed mule networks avoid rule-based filtering  
- Traditional row-by-row database analysis misses relational patterns  

---

## Core Features

- CSV transaction upload  
- Directed graph construction  
- Suspicious account detection  
- Fraud ring identification  
- Interactive visualization  
- Results dashboard  
- JSON export  

---

## Tech Stack

React  
TypeScript  
Vite  
Tailwind CSS  
shadcn/ui  
Vitest  

---

## Local Setup

\`\`\`bash
git clone https://github.com/neha19826/pathproof.git
cd pathproof
npm install
npm run dev
\`\`\`
