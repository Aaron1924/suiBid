# SuiBid Marketplace

SuiBid is a decentralized application (dApp) boilerplate for creating an NFT marketplace on the Sui blockchain. It demonstrates how to connect to Sui wallets, fetch on-chain data, and structure a modern web application using Next.js and TypeScript.

## 🚀 Key Features

-   **Sui Wallet Integration:** Connects with Sui wallets using the `@mysten/dapp-kit`.
-   **On-Chain Data Fetching:** Demonstrates fetching a user's owned objects (`getOwnedObjects`) and details for a specific object (`getObject`).
-   **Hybrid Data Model:** Includes a mock marketplace for rapid UI development and prototyping, alongside live on-chain data for user-owned items.
-   **Modern Frontend Stack:** Built with Next.js (App Router), React, TypeScript, and Tailwind CSS.
-   **Component-Based UI:** Features a collection of reusable components built with `shadcn/ui`.
-   **Simulated Transactions:** Includes placeholder logic for placing bids and handling marketplace transactions, ready for smart contract integration.

## Architecture & Tech Stack

The application is a client-side rendered dApp that interacts directly with the Sui blockchain.

-   **Framework:** [Next.js](https://nextjs.org/) (with App Router)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Sui Integration:** [@mysten/dapp-kit](https://github.com/MystenLabs/dapp-kit) for wallet connections and data fetching.
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) for components.
-   **State Management:** `@tanstack/react-query` (via `dapp-kit`) for caching blockchain data.

### Code Example: Fetching On-Chain Data

The following snippet from `app/my-items/page.tsx` shows how the application uses `useSuiClientQuery` to fetch a user's owned objects.

```typescript
"use client"

import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit"
import { ItemCard } from "@/components/item-card"
// ...

export default function MyItemsPage() {
  const account = useCurrentAccount()

  const { data, isLoading, error } = useSuiClientQuery(
    "getOwnedObjects",
    {
      owner: account?.address ?? "",
      options: { showContent: true, showDisplay: true, showType: true },
      limit: 50,
    },
    { enabled: !!account },
  )

  const items = data?.data?.map((obj) => parseObjectToItem(obj))
  // ...
}
```

## 🏁 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

-   Node.js (v18 or later)
-   pnpm (or your preferred package manager)

### Installation & Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/suibid.git
    cd suibid
    ```
2.  Install dependencies:
    ```bash
    pnpm install
    ```
3.  Run the development server:
    ```bash
    pnpm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📂 Project Structure

-   `app/`: Contains the pages and routing structure for the Next.js App Router.
-   `components/`: Reusable React components used throughout the application.
-   `lib/`: Utility functions, constants, and data transformation logic (e.g., `sui-utils.ts`).
-   `public/`: Static assets like images and icons.

## 🔄 Data Model

The application uses a hybrid data model to facilitate development:

-   **Public Marketplace (`/`)**: This route displays a list of mock NFT listings from `lib/mock-marketplace-items.ts`. This allows for frontend development and testing without needing live smart contracts.
-   **User's Items (`/my-items`)**: This route connects to a user's Sui wallet and fetches their actual on-chain objects, displaying them in a grid.
-   **Item Details (`/item/[id]`)**: The detail page intelligently determines whether to show mock data or fetch on-chain data based on the item's ID, providing a seamless experience.
