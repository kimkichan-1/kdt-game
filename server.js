const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 정적 파일 서빙을 위한 디렉토리 설정
// 현재 프로젝트의 모든 파일이 루트에 있으므로, 'public' 디렉토리로 이동시키거나
// 아니면 현재 루트 디렉토리를 정적 파일 서빙 경로로 지정해야 합니다.
// 여기서는 프로젝트의 모든 파일을 'public' 디렉토리로 옮기는 것을 가정합니다.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
