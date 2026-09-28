import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { EditorComponent } from "~/components/Editor";
export type code = {
  id: string;
  nodeType: string;
  code: string;
};

const FetchCode = async (id: string, version: string) => {
  //コンパイル
  const compileRes = await fetch(
    `https://ceres.epi.it.matsue-ct.ac.jp/rwire/project/${id}/convert`,
    {
      method: "POST",
      body: JSON.stringify({ version: version }),
    },
  );
  if (!compileRes.ok) {
    return null;
  }
  //コンパイルしたものを取得
  const fetchCodeRes = await fetch(
    `https://ceres.epi.it.matsue-ct.ac.jp/rwire/project/${id}`,
  );
  if (!fetchCodeRes.ok) {
    return null;
  }
  const json = await fetchCodeRes.json();
  return json;
};

export function Main() {
  const [codeList, setCodeList] = useState<code[]>([]);
  const [openRight, setOpenRight] = useState<number>(0);
  const [openLeft, setOpenLeft] = useState<number>(0);
  const [isMultiEditor, setIsMultiEditor] = useState(false);
  const queryString = useLocation();
  const [mainId, setMainId] = useState<string>();
  const compilerVersions = ["3.4.0", "4.0.0"];
  useEffect(() => {
    setMainId(queryString.search.split("=")[1]);
  },[]);

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
    const loadData = async () => {
      if (!mainId) return;
      const fetchedCode = await FetchCode(mainId, compilerVersion);
      console.log(fetchedCode.data);
      const newItems = [
        { id: mainId, nodeType: "Main", code: atob(fetchedCode.data.mainCode) },
        ...fetchedCode.data.nodeCodes.map((data: code) => ({
          id: data.id,
          nodeType: data.nodeType,
          code: atob(data.code),
        })),
      ];

      setCodeList((prevList) => {
        const newIds = new Set(newItems.map((item) => item.id));
        const filtered = prevList.filter((item) => !newIds.has(item.id));
        return [...filtered, ...newItems];
      });
    };
    loadData();
  }, [mainId, compilerVersion]);

  const handleEditorChange = (value: string | undefined, openIndex: number) => {
    const newValue = value || "";

    setCodeList((prevList) => {
      const newList = [...prevList];
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

  return (
    <div>
      <h1 className="flex text-3xl font-bold m-2 text-gray-800">
        mruby/c Editor
      </h1>

      <div className="flex flex-row items-end justify-end m-2 gap-3">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={toggleMultiEditor}
        >
          {isMultiEditor ? "タブを1つにする" : "タブを2つにする"}
        </button>

        <input
          id="sendButton"
          type="submit"
          value="マイコンへ書き込む"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          onClick={async () => {
            const res = await fetch(
              "https://ceres.epi.it.matsue-ct.ac.jp/compile/code",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  code: btoa(
                    codeList.find((data: code) => data.id === mainId)?.code ||
                      "",
                  ),
                }),
              },
            );
            if (!res.ok) {
              alert("アップロードに失敗しました");
              return;
            }

            const json = await res.json();
            window.open(
              `https://kaniwriter.poporon.org/?id=${json.id}`,
              "_blank",
            );
          }}
        />

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
            {compilerVersions.map((version) => {
              return (
                <option key={version} value={version}>
                  {version}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <div className="mx-2 border-3 dark:border-zinc-400 ">
        <div className="flex bg-gray-800">
          <EditorComponent
            code={codeList[openRight]?.code || ""}
            handleEditorChange={(value) => handleEditorChange(value, openRight)}
            codeList={codeList}
            setCodeList={setCodeList}
            open={openRight}
            setOpen={setOpenRight}
            setMainId={setMainId}
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
                setMainId={setMainId}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
