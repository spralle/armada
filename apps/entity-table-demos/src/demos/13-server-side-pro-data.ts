import type { PaginationState, SortingState } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";

// --- Types ---
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  lastUpdated: string;
}

// --- Constants ---
export const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports",
  "Books",
  "Food",
  "Toys",
  "Auto",
] as const;

const ADJECTIVES = [
  "Premium",
  "Ultra",
  "Classic",
  "Pro",
  "Essential",
  "Deluxe",
  "Compact",
  "Advanced",
  "Smart",
  "Eco",
  "Turbo",
  "Lite",
];
const NOUNS = ["Widget", "Gadget", "Device", "Kit", "Pack", "Set", "Module", "Unit", "System", "Tool", "Gear", "Hub"];

function generateProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, i) => {
    const adj = ADJECTIVES[i % ADJECTIVES.length];
    const noun = NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length];
    const cat = CATEGORIES[i % CATEGORIES.length];
    const month = String(1 + (i % 12)).padStart(2, "0");
    const day = String(1 + (i % 28)).padStart(2, "0");
    return {
      id: `prod-${String(i + 1).padStart(4, "0")}`,
      name: `${adj} ${noun} ${cat.slice(0, 3)}-${i + 1}`,
      category: cat,
      price: 9.99 + ((i * 1327) % 49000) / 100,
      stock: (i * 37) % 500,
      rating: 1 + ((i * 7) % 50) / 10,
      lastUpdated: `2024-${month}-${day}`,
    };
  });
}

const ALL_PRODUCTS = generateProducts(1000);

// --- Fake API ---
interface FakeApiParams {
  sorting: SortingState;
  search: string;
  pagination: PaginationState;
  shouldError: boolean;
}

export interface FakeApiResult {
  rows: Product[];
  totalCount: number;
  isEstimate: boolean;
}

export function fakeApiCall(params: FakeApiParams): Promise<FakeApiResult> {
  return new Promise((resolve, reject) => {
    const delay = 400 + Math.random() * 200;
    setTimeout(() => {
      if (params.shouldError) {
        reject(new Error("Server unavailable — connection timed out"));
        return;
      }

      let filtered = ALL_PRODUCTS;
      if (params.search) {
        const lower = params.search.toLowerCase();
        filtered = filtered.filter(
          (p) => p.name.toLowerCase().includes(lower) || p.category.toLowerCase().includes(lower),
        );
      }

      if (params.sorting.length > 0) {
        const { id, desc } = params.sorting[0];
        filtered = [...filtered].sort((a, b) => {
          const aVal = a[id as keyof Product];
          const bVal = b[id as keyof Product];
          if (aVal < bVal) return desc ? 1 : -1;
          if (aVal > bVal) return desc ? -1 : 1;
          return 0;
        });
      }

      const { pageIndex, pageSize } = params.pagination;
      const start = pageIndex * pageSize;
      const rows = filtered.slice(start, start + pageSize);
      const totalCount = filtered.length;

      resolve({ rows, totalCount, isEstimate: totalCount > 500 });
    }, delay);
  });
}

// --- useQuery simulation (stale-while-revalidate) ---
export interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export function useSimulatedQuery<T>(queryKey: unknown[], queryFn: () => Promise<T>): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const fetchIdRef = useRef(0);
  const keyRef = useRef("");
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const execute = useCallback(() => {
    const id = ++fetchIdRef.current;
    setIsFetching(true);
    setError(null);

    queryFnRef
      .current()
      .then((result) => {
        if (id !== fetchIdRef.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (id !== fetchIdRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (id !== fetchIdRef.current) return;
        setIsFetching(false);
      });
  }, []);

  const serializedKey = JSON.stringify(queryKey);
  useEffect(() => {
    if (keyRef.current !== serializedKey) {
      keyRef.current = serializedKey;
      execute();
    }
  }, [serializedKey, execute]);

  const isLoading = isFetching && data === undefined;

  return { data, error, isLoading, isFetching, refetch: execute };
}
