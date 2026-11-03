export const CONTACT_FILE_LIMIT = 2 * 1024 * 1024;
export const CONTACT_FILE_COUNT = 20;
export const CONTACT_FILE_TYPES: Record<string,string> = {
  pdf:'application/pdf',txt:'text/plain',md:'text/markdown',csv:'text/csv',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',webm:'audio/webm',
};
export function validateContactFile(filename: string, bytes: Uint8Array) {
  const name = filename.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g,'').trim();
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const mime = CONTACT_FILE_TYPES[extension];
  if (!name || name.length > 180 || !mime) throw Error('Formato non supportato. Usa PDF, DOCX, testo o audio.');
  if (!bytes.length || bytes.length > CONTACT_FILE_LIMIT) throw Error('Ogni file deve essere non vuoto e di massimo 2 MB.');
  const ascii = (start: number,length: number) => String.fromCharCode(...bytes.slice(start,start+length));
  const starts = (...values: number[]) => values.every((value,index)=>bytes[index]===value);
  const valid = extension==='pdf' ? ascii(0,5)==='%PDF-' : extension==='docx' ? starts(0x50,0x4b,0x03,0x04)
    : extension==='mp3' ? ascii(0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224)
    : extension==='wav' ? ascii(0,4)==='RIFF' && ascii(8,4)==='WAVE'
    : ['ogg','opus'].includes(extension) ? ascii(0,4)==='OggS'
    : extension==='m4a' ? ascii(4,4)==='ftyp' : extension==='webm' ? starts(0x1a,0x45,0xdf,0xa3) : true;
  if (!valid) throw Error('Il contenuto del file non corrisponde al formato indicato.');
  if (['txt','md','csv'].includes(extension)) {
    try { if (new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\u0000')) throw Error(); }
    catch { throw Error('Il documento di testo deve essere in formato UTF-8.'); }
  }
  return {name,mime};
}
export const contactFileMetadata = (row: Record<string,unknown>) => ({id:String(row.id),name:String(row.name),mime:String(row.mime),size:Number(row.size),authorId:String(row.author_id),authorName:String(row.author_name),createdAt:String(row.created_at)});
