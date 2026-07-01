import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { EditorComponent } from "~/components/Editor";
export type code = {
  id: string;
  nodeType: string;
  code: string;
};

const FetchCode = async (id: string) => {
  //コンパイル
  const compileRes = await fetch(
    `https://ceres.epi.it.matsue-ct.ac.jp/rwire/project/${id}/convert`,
    {
      method: "POST",
    },
  );
  if (!compileRes.ok) {
    return "";
  }
  //コンパイルしたものを取得
  const fetchCodeRes = await fetch(
    `https://ceres.epi.it.matsue-ct.ac.jp/rwire/project/${id}`,
  );
  if (!fetchCodeRes.ok) {
    return "";
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
  const mainId = queryString.search.split("=")[1];
  useEffect(() => {
    const loadData = async () => {
      if (!mainId) return;
      const fetchedCode = await FetchCode(mainId);
      console.log(fetchedCode.data);
      const newItems = [
        { id: mainId, nodeType: "Main", code: atob(fetchedCode.data.mainCode) },
        ...fetchedCode.data.nodeCodes.map((data: code) => ({
          id: data.id,
          nodeType: data.nodeType,
          code: atob(data.code),
        })),
      ];

      setCodeList((prevList) => [...prevList, ...newItems]);
    };
    loadData();
  }, [mainId]);

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
      <h1 className="flex  text-3xl font-bold m-2 text-gray-800">
        mruby/c Editor
      </h1>
      <div className="flex flex-row justify-end m-2 gap-2">
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
              `https://ceres.epi.it.matsue-ct.ac.jp/writer?id=${json.id}`,
              "_blank",
            );
          }}
        />
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
