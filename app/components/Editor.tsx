import React from "react";
import { Editor } from "@monaco-editor/react";
import type { code as CodeListType } from "~/main/main";
import { FaRegPlusSquare } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

interface EditorComponentProps {
  code: string;
  handleEditorChange: (value: string | undefined) => void;
  codeList: CodeListType[];
  setCodeList: (
    value: CodeListType[] | ((prevState: CodeListType[]) => CodeListType[]),
  ) => void;
  open: number;
  setOpen: (index: number) => void;
}

export const EditorComponent: React.FC<EditorComponentProps> = ({
  code,
  handleEditorChange,
  codeList,
  setCodeList,
  open,
  setOpen,
}) => {
  const isManual = (id: string) => id.startsWith("new_");

  const handleRemoveTab = (index: number) => {
    setCodeList((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (open >= next.length) {
        setOpen(Math.max(0, next.length - 1));
      } else if (open > index) {
        setOpen(open - 1);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      <div className="flex flex-row gap-2 mb-2 bg-amber-100">
        {codeList.map((data: CodeListType, index: number) => (
          <div
            key={data.id}
            className={
              index === open
                ? "flex items-center border-b-2 border-indigo-500 font-bold text-indigo-500"
                : "flex items-center text-gray-400 font-bold"
            }
          >
            <button onClick={() => setOpen(index)} className="px-2">
              {data.nodeType}
            </button>

            {isManual(data.id) && (
              <button
                onClick={() => handleRemoveTab(index)}
                className="pr-1 opacity-50 hover:opacity-100 hover:text-red-500 transition-opacity"
                title="タブを削除"
              >
                <IoClose size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => {
            const newIndex = codeList.length;
            setCodeList((prev) => [
              ...prev,
              {
                id: `new_${Date.now()}`,
                nodeType: `新規_${newIndex}`,
                code: "",
              },
            ]);
            setOpen(newIndex);
          }}
          className="text-gray-400 hover:text-indigo-500"
        >
          <FaRegPlusSquare />
        </button>
      </div>
      <Editor
        theme="vs-dark"
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
