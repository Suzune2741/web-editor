import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { EditorComponent } from "~/components/Editor";

export type code = {
  id: string;
  nodeType: string;
  code: string;
};

const API_BASE = "https://ceres.epi.it.matsue-ct.ac.jp/rwire";

const encodeBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const FetchCode = async (id: string, version: string) => {
  const compileRes = await fetch(`${API_BASE}/project/${id}/convert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version }),
  });

  if (!compileRes.ok) {
    return null;
  }

  const fetchCodeRes = await fetch(`${API_BASE}/project/${id}`);

  if (!fetchCodeRes.ok) {
    return null;
  }

  return await fetchCodeRes.json();
};

export function Main() {
  const [codeList, setCodeList] = useState<code[]>([]);
  const [openRight, setOpenRight] = useState<number>(0);
  const [openLeft, setOpenLeft] = useState<number>(0);
  const [isMultiEditor, setIsMultiEditor] = useState(false);
  const [isRecompiling, setIsRecompiling] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const queryString = useLocation();
  const [mainId, setMainId] = useState<string>();
  const compilerVersions = ["3.4.0", "4.0.0"];

  useEffect(() => {
    const params = new URLSearchParams(queryString.search);
    setMainId(params.get("id") ?? undefined);
  }, [queryString.search]);

  const [compilerVersion, setCompilerVersion] = useState(() => {
    if (typeof window === "undefined") {
      return compilerVersions[0] || "";
    }

    return localStorage.getItem("compilerVersion") || compilerVersions[0] || "";
  });

  useEffect(() => {
    localStorage.setItem("compilerVersion", compilerVersion);
  }, [compilerVersion]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      if (!mainId) return;

      setIsConverting(true);
      try {
        const fetchedCode = await FetchCode(mainId, compilerVersion);

        if (!fetchedCode || fetchedCode.status !== "ok") {
          if (!cancelled) alert("コードの取得に失敗しました");
          return;
        }

        const newItems: code[] = [
          {
            id: mainId,
            nodeType: "Main",
            code: decodeBase64(fetchedCode.data.mainCode),
          },
          ...fetchedCode.data.nodeCodes.map((item: code) => ({
            id: item.id,
            nodeType: item.nodeType,
            code: decodeBase64(item.code),
          })),
        ];

        if (!cancelled) {
          setCodeList(newItems);
          setOpenRight(0);
          setOpenLeft(0);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          alert("サーバーとの通信に失敗しました");
        }
      } finally {
        if (!cancelled) setIsConverting(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mainId, compilerVersion]);

  const handleEditorChange = (value: string | undefined, openIndex: number) => {
    const newValue = value || "";

    setCodeList((prevList) => {
      const newList = [...prevList];

      if (!newList[openIndex]) return prevList;

      newList[openIndex] = {
        ...newList[openIndex],
        code: newValue,
      };

      return newList;
    });
  };

  const toggleMultiEditor = () => {
    setIsMultiEditor((prev) => !prev);
  };

  const handleRecompile = async () => {
    if (!mainId) {
      alert("プロジェクトIDが取得できません");
      return;
    }

    if (isRecompiling || isConverting) return;

    setIsRecompiling(true);

    try {
      const nodeCodes = codeList
        .filter((item) => item.nodeType !== "Main")
        .map((item) => ({
          id: item.id,
          code: encodeBase64(item.code),
        }));

      const res = await fetch(`${API_BASE}/project/${mainId}/recompile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: compilerVersion,
          nodeCodes,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.status !== "ok") {
        alert(
          [json.error?.message, json.error?.details]
            .filter(Boolean)
            .join("\n") || "再コンパイルに失敗しました",
        );
        return;
      }

      const newItems: code[] = [
        {
          id: mainId,
          nodeType: "Main",
          code: decodeBase64(json.data.mainCode),
        },
        ...json.data.nodeCodes.map((item: code) => ({
          id: item.id,
          nodeType: item.nodeType,
          code: decodeBase64(item.code),
        })),
      ];

      setCodeList(newItems);

      alert("再コンパイルに成功しました");
    } catch (e) {
      console.error(e);
      alert("再コンパイル中にエラーが発生しました");
    } finally {
      setIsRecompiling(false);
    }
  };

  const handleWriteToMcu = async () => {
    try {
      const mainCode = codeList.find((item) => item.id === mainId)?.code;

      if (mainCode === undefined) {
        alert("Mainコードが見つかりません");
        return;
      }

      const res = await fetch(
        "https://ceres.epi.it.matsue-ct.ac.jp/compile/code",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: encodeBase64(mainCode),
          }),
        },
      );

      const json = await res.json();

      if (!res.ok) {
        alert("アップロードに失敗しました");
        return;
      }

      window.open(`https://kaniwriter.poporon.org/?id=${json.id}`, "_blank");
    } catch (e) {
      console.error(e);
      alert("マイコン書き込みサーバーとの通信に失敗しました");
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
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={toggleMultiEditor}
        >
          {isMultiEditor ? "タブを1つにする" : "タブを2つにする"}
        </button>

        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={handleWriteToMcu}
        >
          マイコンへ書き込む
        </button>

        <button
          type="button"
          disabled={isRecompiling || isConverting || !mainId}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={handleRecompile}
        >
          {isRecompiling ? "再コンパイル中..." : "再コンパイル"}
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
            onChange={(e) => setCompilerVersion(e.target.value)}
            className="flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {compilerVersions.map((version) => (
              <option key={version} value={version}>
                {version}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mx-2 border-3 dark:border-zinc-400">
        <div className="flex bg-gray-800">
          <EditorComponent
            code={codeList[openRight]?.code || ""}
            handleEditorChange={(value) => handleEditorChange(value, openRight)}
            codeList={codeList}
            setCodeList={setCodeList}
            open={openRight}
            setOpen={setOpenRight}
          />

          {isMultiEditor && (
            <>
              <span className="w-1 bg-gray-100" />

              <EditorComponent
                code={codeList[openLeft]?.code || ""}
                handleEditorChange={(value) =>
                  handleEditorChange(value, openLeft)
                }
                codeList={codeList}
                setCodeList={setCodeList}
                open={openLeft}
                setOpen={setOpenLeft}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
