import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { EditorComponent } from "~/components/Editor";
export type code = {
  id: string;
  code: string;
};

const FetchCode = async (id: string) => {
  //実際のURLへ置き換える
  const res = await fetch(`http://localhost:8000/code/${id}`);
  if (!res.ok) {
    return "";
  }
  const json = await res.json();
  return json;
};

export function Main() {
  const [codeList, setCodeList] = useState<code[]>([]);
  const [openRight, setOpenRight] = useState<number>(0);
  const [openLeft, setOpenLeft] = useState<number>(0);
  const queryString = useLocation();
  const mainid = queryString.search.split("=")[1];
  useEffect(() => {
    const loadData = async () => {
      if (!mainid) return;
      const fetchedCode = await FetchCode(mainid);

      console.log(fetchedCode.nodecodes);
      const newItems = [
        { id: mainid, code: atob(fetchedCode.maincode) },
        ...fetchedCode.nodecodes.map((data: code) => ({
          id: data.id,
          code: atob(data.code),
        })),
      ];

      setCodeList((prevList) => [...prevList, ...newItems]);
    };
    loadData();
  }, [mainid]);

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

  return (
    <div>
      <h1 className="flex justify-center text-3xl font-bold m-2">
        mruby/c Editor
      </h1>
      <main className=" mx-4 border-3 dark:border-zinc-400 bg-white">
        <div className="flex">
          <EditorComponent
            code={codeList[openRight]?.code || ""}
            handleEditorChange={(value) => handleEditorChange(value, openRight)}
            codeList={codeList}
            open={openRight}
            setOpen={setOpenRight}
          />
          <span className="w-1 bg-gray-800" />
          <EditorComponent
            code={codeList[openLeft]?.code || ""}
            handleEditorChange={(value) => handleEditorChange(value, openLeft)}
            codeList={codeList}
            open={openLeft}
            setOpen={setOpenLeft}
          />
        </div>
      </main>

      <button
        className="m-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
        onClick={async () => {
          const res = await fetch(
            "https://ceres.epi.it.matsue-ct.ac.jp/compile/code",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code: codeList.map((obj) => btoa(obj.code)),
              }),
            },
          );
          if (!res.ok) {
            alert("アップロードに失敗しました");
            return;
          }
          const json = await res.json();
          console.log(json.id);
          const ids = json.id.split("_");
          console.log(ids);
          ids.map(async (id: string) => {
            const compileRes = await fetch(
              `https://ceres.epi.it.matsue-ct.ac.jp/compile/code/${id}/compile`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  version: "3.3.0",
                }),
              },
            );
            if (!compileRes.ok) {
              alert("アップロードに失敗しました");
              return;
            }
            const json = await compileRes.json();
          });
        }}
      >
        再ビルド
      </button>
      <input
        id="sendButton"
        type="submit"
        value="マイコンへ書き込む"
        className="m-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
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
                  codeList.find((data: code) => data.id === mainid)?.code || "",
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
  );
}
