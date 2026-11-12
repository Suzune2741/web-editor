import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { EditorComponent } from "~/components/Editor";

export type code = {
  id: string;
  nodeType: string;
  code: string;
};

const API_BASE = "https://ceres.epi.it.matsue-ct.ac.jp/rwire";
const COMPILE_URL = "https://ceres.epi.it.matsue-ct.ac.jp/compile/code";

const COMPILER_VERSIONS = ["3.4.0", "4.0.0"] as const;
type CompilerVersion = (typeof COMPILER_VERSIONS)[number];
const DEFAULT_VERSION: CompilerVersion = COMPILER_VERSIONS[0];
const VERSION_STORAGE_KEY = "compilerVersion";

type ProjectData = {
  mainCode: string;
  nodeCodes: code[];
};

type ProjectResponse = {
  status: string;
  data?: ProjectData;
  error?: { message?: string; details?: string };
};

type Status = "idle" | "converting" | "recompiling";

const BUTTON_BASE =
  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
const BUTTON_GREEN = `${BUTTON_BASE} bg-emerald-600 hover:bg-emerald-700`;
const BUTTON_BLUE = `${BUTTON_BASE} bg-blue-600 hover:bg-blue-700`;


const encodeBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const decodeBase64 = (value: string): string => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

class ApiError extends Error {}

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const readJson = async <T,>(res: Response): Promise<T | null> => {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

const postJson = (url: string, body: unknown, signal?: AbortSignal) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

const toCodeList = (projectId: string, data: ProjectData): code[] => [
  {
    id: projectId,
    nodeType: "Main",
    code: decodeBase64(data.mainCode),
  },
  ...data.nodeCodes.map((item) => ({
    id: item.id,
    nodeType: item.nodeType,
    code: decodeBase64(item.code),
  })),
];

/** プロジェクトを変換し、生成されたコード一覧を取得する */
async function fetchProjectCode(
  id: string,
  version: string,
  signal?: AbortSignal,
): Promise<code[]> {
  const convertRes = await postJson(
    `${API_BASE}/project/${id}/convert`,
    { version },
    signal,
  );
  if (!convertRes.ok) throw new ApiError("コードの取得に失敗しました");

  const res = await fetch(`${API_BASE}/project/${id}`, { signal });
  if (!res.ok) throw new ApiError("コードの取得に失敗しました");

  const json = await readJson<ProjectResponse>(res);
  if (json?.status !== "ok" || !json.data) {
    throw new ApiError("コードの取得に失敗しました");
  }
  return toCodeList(id, json.data);
}

/** 編集したノードのコードを送って再コンパイルする */
async function recompileProject(
  id: string,
  version: string,
  codeList: code[],
): Promise<code[]> {
  const nodeCodes = codeList
    .filter((item) => item.nodeType !== "Main")
    .map((item) => ({ id: item.id, code: encodeBase64(item.code) }));

  const res = await postJson(`${API_BASE}/project/${id}/recompile`, {
    version,
    nodeCodes,
  });
  const json = await readJson<ProjectResponse>(res);

  if (!res.ok || json?.status !== "ok" || !json.data) {
    const message = [json?.error?.message, json?.error?.details]
      .filter(Boolean)
      .join("\n");
    throw new ApiError(message || "再コンパイルに失敗しました");
  }
  return toCodeList(id, json.data);
}

/** Mainコードを書き込みサーバーに送り、書き込み用のIDを返す */
async function uploadMainCode(mainCode: string): Promise<string> {
  const res = await postJson(COMPILE_URL, { code: encodeBase64(mainCode) });
  const json = await readJson<{ id?: string }>(res);
  if (!res.ok || !json?.id) throw new ApiError("アップロードに失敗しました");
  return json.id;
}


const isCompilerVersion = (
  v: string | null | undefined,
): v is CompilerVersion =>
  !!v && (COMPILER_VERSIONS as readonly string[]).includes(v);

const readSavedVersion = (): string | null => {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null; 
  }
};

const saveVersion = (v: CompilerVersion) => {
  try {
    localStorage.setItem(VERSION_STORAGE_KEY, v);
  } catch {
  }
};

function useCompilerVersion(urlVersion: string | null) {
  const [version, setVersionState] = useState<CompilerVersion>(DEFAULT_VERSION);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setVersionState(
      [urlVersion, readSavedVersion()].find(isCompilerVersion) ??
        DEFAULT_VERSION,
    );
    setReady(true);
  }, [urlVersion]);

  // ユーザーが選んだときだけ保存する
  const setVersion = useCallback((v: string) => {
    if (!isCompilerVersion(v)) return;
    setVersionState(v);
    saveVersion(v);
  }, []);

  return { version, setVersion, ready };
}



type EditorPaneProps = {
  codeList: code[];
  setCodeList: React.Dispatch<React.SetStateAction<code[]>>;
  index: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
  onChange: (index: number, value: string | undefined) => void;
};

function EditorPane({
  codeList,
  setCodeList,
  index,
  setIndex,
  onChange,
}: EditorPaneProps) {
  return (
    <EditorComponent
      code={codeList[index]?.code ?? ""}
      handleEditorChange={(value) => onChange(index, value)}
      codeList={codeList}
      setCodeList={setCodeList}
      open={index}
      setOpen={setIndex}
    />
  );
}

export function Main() {
  const [searchParams] = useSearchParams();
  const mainId = searchParams.get("id") ?? undefined;

  const {
    version: compilerVersion,
    setVersion: setCompilerVersion,
    ready: versionReady,
  } = useCompilerVersion(searchParams.get("version"));

  const [codeList, setCodeList] = useState<code[]>([]);
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);
  const [isMultiEditor, setIsMultiEditor] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const busy = status !== "idle";

  // プロジェクトID・バージョンが決まったら変換してコードを取得する
  useEffect(() => {
    if (!mainId || !versionReady) return;

    const controller = new AbortController();

    const load = async () => {
      setStatus("converting");
      try {
        const items = await fetchProjectCode(
          mainId,
          compilerVersion,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setCodeList(items);
        setLeftIndex(0);
        setRightIndex(0);
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error(e);
        alert(errorMessage(e, "サーバーとの通信に失敗しました"));
      } finally {
        if (!controller.signal.aborted) setStatus("idle");
      }
    };
    void load();

    return () => controller.abort();
  }, [mainId, compilerVersion, versionReady]);

  const updateCode = useCallback((index: number, value: string | undefined) => {
    setCodeList((prev) =>
      prev[index]
        ? prev.map((item, i) =>
            i === index ? { ...item, code: value ?? "" } : item,
          )
        : prev,
    );
  }, []);

  const handleRecompile = async () => {
    if (!mainId) {
      alert("プロジェクトIDが取得できません");
      return;
    }
    if (busy) return;

    setStatus("recompiling");
    try {
      setCodeList(await recompileProject(mainId, compilerVersion, codeList));
      alert("再コンパイルに成功しました");
    } catch (e) {
      console.error(e);
      alert(errorMessage(e, "再コンパイル中にエラーが発生しました"));
    } finally {
      setStatus("idle");
    }
  };

  const handleWriteToMcu = async () => {
    const mainCode = codeList.find((item) => item.id === mainId)?.code;
    if (mainCode === undefined) {
      alert("Mainコードが見つかりません");
      return;
    }

    try {
      const writeId = await uploadMainCode(mainCode);
      const url = new URL("https://kaniwriter.poporon.org/");
      url.searchParams.set("id", writeId);
      window.open(url.toString(), "_blank");
    } catch (e) {
      console.error(e);
      alert(errorMessage(e, "マイコン書き込みサーバーとの通信に失敗しました"));
    }
  };

  return (
    <div>
      <h1 className="flex text-3xl font-bold m-2 text-gray-800">
        mruby/c Editor
      </h1>

      <div className="flex flex-row items-end justify-end m-2 gap-3">
        <button
          type="button"
          className={BUTTON_GREEN}
          onClick={() => setIsMultiEditor((prev) => !prev)}
        >
          {isMultiEditor ? "タブを1つにする" : "タブを2つにする"}
        </button>

        <button
          type="button"
          className={BUTTON_GREEN}
          onClick={handleWriteToMcu}
        >
          マイコンへ書き込む
        </button>

        <button
          type="button"
          disabled={busy || !mainId}
          className={BUTTON_BLUE}
          onClick={handleRecompile}
        >
          {status === "recompiling" ? "再コンパイル中..." : "再コンパイル"}
        </button>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="compilerVersion"
            className="text-sm font-medium text-gray-700"
          >
            コンパイラバージョン
          </label>
          <select
            id="compilerVersion"
            value={compilerVersion}
            disabled={busy}
            onChange={(e) => setCompilerVersion(e.target.value)}
            className={BUTTON_GREEN}
          >
            {COMPILER_VERSIONS.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mx-2 border-3 dark:border-zinc-400">
        <div className="flex bg-gray-800">
          <EditorPane
            codeList={codeList}
            setCodeList={setCodeList}
            index={leftIndex}
            setIndex={setLeftIndex}
            onChange={updateCode}
          />
          {isMultiEditor && (
            <>
              <span className="w-1 bg-gray-100" />
              <EditorPane
                codeList={codeList}
                setCodeList={setCodeList}
                index={rightIndex}
                setIndex={setRightIndex}
                onChange={updateCode}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
