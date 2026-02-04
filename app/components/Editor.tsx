import React from "react";
import { Editor } from "@monaco-editor/react";
import type { code as CodeListType } from "~/main/main";

interface EditorComponentProps {
  code: string;
  handleEditorChange: (value: string | undefined) => void;
  codeList: CodeListType[];
  open: number;
  setOpen: (index: number) => void;
}

export const EditorComponent: React.FC<EditorComponentProps> = ({
  code,
  handleEditorChange,
  codeList,
  open,
  setOpen,
}) => {
  return (
    <div className="w-full">
      <div className="flex flex-row gap-2 mb-2 bg-gray-300">
        {codeList.map((data, index) => (
          <div
            key={data.id}
            className={
              index === open
                ? "border-b-2 border-indigo-500 font-bold text-indigo-500"
                : "text-gray-400 font-bold"
            }
          >
            <button onClick={() => setOpen(index)} className="px-2 ">
              {"ファイル名"}
              {/* {data.id} */}
            </button>
          </div>
        ))}
      </div>
      <Editor
        theme="hc-light"
        height="40rem"
        defaultLanguage="ruby"
        value={code}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          scrollbar: { horizontal: "hidden" },
        }}
      />
    </div>
  );
};
