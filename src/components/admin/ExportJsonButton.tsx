import { Button } from '../ui/Button';

interface ExportJsonButtonProps {
  data: unknown;
  filename: string;
  label: string;
}

export function ExportJsonButton({ data, filename, label }: ExportJsonButtonProps) {
  function handleExport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" onClick={handleExport}>
      {label}
    </Button>
  );
}
