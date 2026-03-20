import { Client } from "@atcute/client";
import { DidDocument } from "@atcute/identity";
import { Accessor, createContext, useContext } from "solid-js";

export interface RepoContextValue {
  did: Accessor<string>;
  pds: Accessor<string | undefined>;
  rpc: Accessor<Client | undefined>;
  didDoc: Accessor<DidDocument | undefined>;
  error: Accessor<string | undefined>;
}

const RepoContext = createContext<RepoContextValue>();

export const RepoProvider = RepoContext.Provider;

export const useRepo = () => {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepo must be used within RepoProvider");
  return ctx;
};
