function updateTimetable() {
            const dateSelector = document.getElementById("dateSelector");
            const selectedDate = dateSelector.value;
            const timetableTable = document.getElementById("timetableTable");
            timetableTable.innerHTML = "";
            switch (selectedDate) {
                case "monday":
                    // 월요일 시간표
                    timetableTable.innerHTML = `
                        <tr>
                            <th>요일</th>
                            <th>1교시</th>
                            <th>2교시</th>
                            <th>3교시</th>
                            <th>4교시</th>
                            <th>5교시</th>
                            <th>6교시</th>
                            <th>7교시</th>
                        </tr>
                        <tr>
                            <td>요일</td>
                            <td>자율</td>
                            <td>지리</td>
                            <td>체육</td>
                            <td>수학</td>
                            <td>영어</td>
                            <td>생명</td>
                            <td>진로</td>
                        </tr>
                        <tr>
                            <th>T</th>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>김은정T</td>
                            <td></td>
                            <td></td>
                        </tr>`;
                    break;
                case "tuesday":
                    // 화요일 시간표
                    timetableTable.innerHTML = `
                        <tr>
                            <th>요일</th>
                            <th>1교시</th>
                            <th>2교시</th>
                            <th>3교시</th>
                            <th>4교시</th>
                            <th>5교시</th>
                            <th>6교시</th>
                            <th>7교시</th>
                        </tr>
                        <tr>
                            <td>요일</td>
                            <td>음/미</td>
                            <td>음/미</td>
                            <td>수학</td>
                            <td>일반사회</td>
                            <td>국어</td>
                            <td>영어</td>
                            <td>독/프</td>
                        </tr>
                        <tr>
                            <th>T</th>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>류정민T</td>
                            <td>최소연T</td>
                            <td>공소정T</td>
                            <td></td>
                        </tr>`;
                    break;
                case "wednesday":
                    // 수요일 시간표
                    timetableTable.innerHTML = `
                        <tr>
                            <th>요일</th>
                            <th>1교시</th>
                            <th>2교시</th>
                            <th>3교시</th>
                            <th>4교시</th>
                            <th>5교시</th>
                            <th>6교시</th>
                        </tr>
                        <tr>
                            <td>요일</td>
                            <td>영어</td>
                            <td>한국사</td>
                            <td>체육</td>
                            <td>국어</td>
                            <td>자율</td>
                            <td>자율</td>
                        </tr>
                        <tr>
                            <th>T</th>
                            <td>정민주T</td>
                            <td></td>
                            <td></td>
                            <td>최수진T</td>
                            <td>동아리</td>
                            <td>동아리</td>
                        </tr>`;
                    break;
                case "thursday":
                    // 목요일 시간표
                    timetableTable.innerHTML = `
                        <tr>
                            <th>요일</th>
                            <th>1교시</th>
                            <th>2교시</th>
                            <th>3교시</th>
                            <th>4교시</th>
                            <th>5교시</th>
                            <th>6교시</th>
                            <th>7교시</th>
                        </tr>
                        <tr>
                            <td>요일</td>
                            <td>기가</td>
                            <td>기가</td>
                            <td>국어</td>
                            <td>영어</td>
                            <td>과탐실</td>
                            <td>지구과학</td>
                            <td>수학</td>
                        </tr>
                        <tr>
                            <th>T</th>
                            <td></td>
                            <td></td>
                            <td>김원규T</td>
                            <td>원어민T</td>
                            <td>물리</td>
                            <td></td>
                            <td></td>
                        </tr>`;
                    break;
                case "friday":
                    // 금요일 시간표
                    timetableTable.innerHTML = `
                        <tr>
                            <th>요일</th>
                            <th>1교시</th>
                            <th>2교시</th>
                            <th>3교시</th>
                            <th>4교시</th>
                            <th>5교시</th>
                            <th>6교시</th>
                            <th>7교시</th>
                        </tr>
                        <tr>
                            <td>요일</td>
                            <td>윤리</td>
                            <td>독/프</td>
                            <td>기가</td>
                            <td>화학</td>
                            <td>수학</td>
                            <td>국어</td>
                            <td>한국사</td>
                        </tr>
                        <tr>
                            <th>T</th>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td>김원규T</td>
                            <td></td>
                        </tr>`;
                    break;
            }
        }
