import JSZip from "jszip";
import convert from 'xml-js'

let setData: any;
let zipfilecount = 0;
let dataoutput: any = [];

function receiveData(data: any, filename: any) {
    if (dataoutput[filename] === undefined) dataoutput[filename] = []
    dataoutput[filename].push(data);
    checkData()
}

let countdata: any = []

function setCount(filename: string, count: number) {
    countdata[filename] = count
}

function checkData() {
    if (Object.entries(countdata).map(key => {
        return dataoutput[key[0]].length === key[1]
    }).filter(val => val).length === zipfilecount) {
        let output: any[] = [];
        Object.entries(dataoutput).forEach((key: any) => {
            output[key[0]] =
                `<quiz>
    <question type="category">
        <category>
            <text>$course$/top</text>
        </category>
    </question>
    <question type="category">
        <category>
            <text>$course$/top/${key[0].replace('.zip', '')}</text>
        </category>
    </question>${key[1].join('')}
    </quiz>`})
        setData(output)
    }
}

function readFiles(zipFiles: File[], passedFunction: any) {
    setData = passedFunction;
    zipfilecount += zipFiles.length
    zipFiles.forEach(selectZip)
}

function selectZip(zipFile: File) {
    JSZip.loadAsync(zipFile).then(zip => {
        const files = zip.filter((relativePath, file) => {
            return file.name.endsWith('.zip')
        });

        if (Object.entries(dataoutput).filter((obj: any) => obj[0]===zipFile.name).length===1) {
            dataoutput[zipFile.name] = [];
            zipfilecount--;
        }
        if (files.length === 1) {
            files[0].async('arraybuffer').then(zip => JSZip.loadAsync(zip).then(loadedZip => readZip(loadedZip, zipFile.name)))
        } else {
            readZip(zip, zipFile.name)
        }
    })
}

function readZip(zip: JSZip, fileName: any) {
    const files = zip.filter(file => file.startsWith("content/") && file.endsWith(".xml"));
    setCount(fileName, files.length)
    files.forEach(file => {
        file.async("text").then(text => generateText(text, fileName))
    })
}

// TODO: Image Support
function generateText(text: string, filename: string) {
    const data = JSON.parse(convert.xml2json(text, {compact: true}));
    let type;
    if (Array.isArray(data['imsqti:assessmentItem']['imsqti:responseDeclaration'])) {
        receiveData(handleClozes(data), filename)
    } else {
        type = data['imsqti:assessmentItem']['imsqti:responseDeclaration']._attributes.cardinality;
        if (type === 'single') {
            receiveData(handleSingle(data), filename)
        } else if (type === 'multiple') {
            receiveData(handleMultiple(data), filename)
        }
    }
}

function handleSingle(data: any) {
    const correctResponseId = data['imsqti:assessmentItem']['imsqti:responseDeclaration']['imsqti:correctResponse']['imsqti:value']._text;
    const answers = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:simpleChoice'];
    return `
    <question type="multichoice">
        <name>
            <text>${data['imsqti:assessmentItem']._attributes.title}</text>
        </name>
        <questiontext format="html">
            <text>
                <![CDATA[${fixQuestion(data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:prompt']['imsqti:span']
        .map((span: any) => span._text).filter((val: any) => val).join('\n\n').replaceAll('<neg>', '<strong>').replaceAll('</neg>', '</strong>'))}]]></text>
        </questiontext>
        <defaultgrade>1.0000000</defaultgrade>
        <penalty>0.3333333</penalty>
        <hidden>0</hidden>
        <single>true</single>
        <shuffleanswers>true</shuffleanswers>
        <answernumbering>none</answernumbering>
        <correctfeedback format="html">
            <text>Die Antwort ist richtig.</text>
        </correctfeedback>
        <partiallycorrectfeedback format="html">
            <text>Die Antwort ist teilweise richtig.</text>
        </partiallycorrectfeedback>
        <incorrectfeedback format="html">
            <text>Die Antwort ist falsch.</text>
        </incorrectfeedback>
        <shownumcorrect/>
        ${answers.map((answer: any) =>
        `<answer fraction="${correctResponseId === answer._attributes.identifier ? 100 : 0}" format="html">
            <text>
                <![CDATA[${answer._text}]]>
            </text>
        </answer>
        `).join('')
    }
    </question>`
}

function handleMultiple(data: any) {
    const matchInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:matchInteraction'];
    const question = matchInteraction['imsqti:prompt']['imsqti:span'][1]._text;
    const choices = matchInteraction['imsqti:simpleMatchSet'][0]['imsqti:simpleAssociableChoice'];
    const solutions = data['imsqti:assessmentItem']['imsqti:responseDeclaration']['imsqti:correctResponse']['imsqti:value'];
    const answers = choices.map((obj: any) => [
        obj._text,
        solutions
            .filter((solution: any) => solution._text.split(' ')[0] === obj._attributes.identifier)
            .map((solution: any) => solution._text.split(' ')[1] === 'richtig')[0]
    ]);
    return `
        <question type="kprime">
            <name>
                <text>${(data['imsqti:assessmentItem']._attributes.title)}</text>
            </name>
            <questiontext format="html">
                <text><![CDATA[${fixQuestion(question)}]]></text>
            </questiontext>
            <defaultgrade>2.0000000</defaultgrade>
            <penalty>0.3333333</penalty>
            <hidden>0</hidden>
            <scoringmethod>
                <text>kprime</text>
            </scoringmethod>
            <shuffleanswers>true</shuffleanswers>
            <numberofrows>4</numberofrows>
            <numberofcolumns>2</numberofcolumns>
${answers.map((answer: any, index: number) =>
        `            <row number="${index + 1}">
                <optiontext format="html">
                    <text><![CDATA[${answer[0]}]]></text>
                </optiontext>
                <feedbacktext format="html"><text></text></feedbacktext>
            </row>`
    ).join('\n')}
${['Ja', 'Nein'].map((text: string, index: number) =>
        `            <column number="${index + 1}">
                <responsetext format="moodle_auto_format">
                    <text>${text}</text>
                </responsetext>
            </column>`
    ).join('\n')}
${Array.from(new Array(4).keys()).map((_val, index: number) =>
        Array.from(new Array(2).keys()).map((_val, index2: number) =>
            `            <weight rownumber="${index + 1}" columnnumber="${index2 + 1}">
                <value>
                    ${answers[index][1] ? 1 - index2 : index2}.000
                </value>
            </weight>`
        ).join('\n')
    ).join('\n')}
        </question>
    `
}

function handleClozes(data: any) {
    return `
    <question type="cloze">
        <name>
          <text>Fall ${data['imsqti:assessmentItem']._attributes.title}</text>
        </name>
        <questiontext format="html">
          <text><![CDATA[
            <u>Fallbeschreibung mit ${data['imsqti:assessmentItem']['imsqti:responseDeclaration'].length} Teilfragen:</u>
            </br>
            ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:p']?._text}
            </br>
            </br>
    ${data['imsqti:assessmentItem']['imsqti:responseDeclaration'].map((responseDeclaration: any, index: number) => {
        if (responseDeclaration._attributes.cardinality === 'multiple') {
            return `
        <u>Teilfrage ${index + 1}:</u></br></br>
        ${handleMultipleCloze(data, responseDeclaration._attributes.identifier)}
        </br>`
        } else if (responseDeclaration._attributes.cardinality === 'single') {
            return `
        <u>Teilfrage ${index + 1}:</u></br></br>
        ${handleSingleCloze(data, responseDeclaration._attributes.identifier)}
        </br>`
        }
        return '';
    }).join('\n')}]]></text>
        </questiontext>
        <generalfeedback format="moodle_auto_format">
          <text></text>
        </generalfeedback>
        <penalty>0.3333333</penalty>
        <hidden>0</hidden>
    </question>`
}

function handleSingleCloze(data: any, id: any) {
    const correctResponseId = data['imsqti:assessmentItem']['imsqti:responseDeclaration'].filter((obj: any) => obj._attributes.identifier === id)[0]['imsqti:correctResponse']['imsqti:value']._text;
    let choiceInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'];
    if (Array.isArray(choiceInteraction)) {
        choiceInteraction = choiceInteraction.filter(interaction =>
            interaction._attributes.responseIdentifier === id
        )[0]
    }
    return `
        <p dir="ltr" style="text-align: left;">
            ${fixQuestion(choiceInteraction['imsqti:prompt']['imsqti:span'][1]._text)}
            <br>(Bitte kreuzen Sie eine Antwort an!)
        </p>
        <p dir="ltr" style="text-align: left;">
            {1:MCVS:${choiceInteraction['imsqti:simpleChoice'].map((choice: any) => `~${choice._attributes.identifier === correctResponseId ? '%100%' : ''}&amp;nbsp;&amp;nbsp;${choice._text}`).join('')}}<br>
        </p>`
}

function handleMultipleCloze(data: any, id: any) {
    const correctResponseIds = data['imsqti:assessmentItem']['imsqti:responseDeclaration'].filter((response: any) =>
        response._attributes.identifier === id
    )[0]['imsqti:correctResponse']['imsqti:value'].map((obj: any) => obj._text);

    let matchInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:matchInteraction']
    if (Array.isArray(matchInteraction)) {
        matchInteraction = matchInteraction.filter(interaction =>
            interaction._attributes.responseIdentifier === id
        )[0]
    }

    const answers = matchInteraction['imsqti:simpleMatchSet'][0]['imsqti:simpleAssociableChoice']
        .map((obj: any) => [
            obj._text,
            correctResponseIds.filter((correct: any) => correct.split(" ")[0] === obj._attributes.identifier)[0].split(" ")[1] === 'richtig'
        ])

    const random = Math.round(Math.random() * 1000000);
    const questionText = matchInteraction['imsqti:prompt']['imsqti:span'][1]._text;
    const kprimCode = calcKprimCode(answers.map((obj: any) => obj[1] ? 1 : 0).join(''))

    return `
    <!--
    Copyright 2021 by Dominique Bauer.
    Creative Commons CC0 1.0 Universal Public Domain Dedication.
    -->
    
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
    <script>
    $(document).ready(function() {
        $("table.answer").css("border","none");
        $("table.answer tr").css("border","none");
        $("table.answer td").css("width","90px");
        $("#mf${random}-kprime input").hide();
    
        // RETRIEVE TEMPORARILY STORED CHECKED RADIO BUTTONS
        // REQUIRED WHEN NOT ALL CHOICES ARE SELECTED
        var rkp1 = sessionStorage.getItem("${random}kp1");
        var rkp2 = sessionStorage.getItem("${random}kp2");
        var rkp3 = sessionStorage.getItem("${random}kp3");
        var rkp4 = sessionStorage.getItem("${random}kp4");
        $("input[name=mf${random}-kprime1][value="+rkp1+"]").prop("checked", true);
        $("input[name=mf${random}-kprime2][value="+rkp2+"]").prop("checked", true);
        $("input[name=mf${random}-kprime3][value="+rkp3+"]").prop("checked", true);
        $("input[name=mf${random}-kprime4][value="+rkp4+"]").prop("checked", true);
    
        // RETRIEVE PERMANENTLY SAVED ANSWER
        var mfAns = $("#mf${random}-kprime input").val();
        var mfAnss = mfAns.toString();
        var akp1 = mfAnss.slice(0,1);
        var akp2 = mfAnss.slice(1,2);
        var akp3 = mfAnss.slice(2,3);
        var akp4 = mfAnss.slice(3,4);
    
        var akpn = parseInt(akp1) + parseInt(akp2) + parseInt(akp3) + parseInt(akp4);
        if (Number.isInteger(akpn)) {
            $("#mf${random}-kprime input").val(mfAns);
            sessionStorage.clear();
        }
    
        $("input[name=mf${random}-kprime1][value="+akp1+"]").prop("checked", true);
        $("input[name=mf${random}-kprime2][value="+akp2+"]").prop("checked", true);
        $("input[name=mf${random}-kprime3][value="+akp3+"]").prop("checked", true);
        $("input[name=mf${random}-kprime4][value="+akp4+"]").prop("checked", true);
    });
    
    function mf${random}Kprime() {
        var kp1 = $("input:checked[name=mf${random}-kprime1]").val();
        var kp2 = $("input:checked[name=mf${random}-kprime2]").val();
        var kp3 = $("input:checked[name=mf${random}-kprime3]").val();
        var kp4 = $("input:checked[name=mf${random}-kprime4]").val();
    
        // STORE TEMPORARILY CHECKED RADIO BUTTONS
        sessionStorage.setItem("${random}kp1", kp1);
        sessionStorage.setItem("${random}kp2", kp2);
        sessionStorage.setItem("${random}kp3", kp3);
        sessionStorage.setItem("${random}kp4", kp4);
    
        var kpn = parseInt(kp1) + parseInt(kp2) + parseInt(kp3) + parseInt(kp4);
        var kps = kp1 + kp2 + kp3 + kp4;
        if (Number.isInteger(kpn)) {
            $("#mf${random}-kprime input").val(kps);
            sessionStorage.clear();
        }
    }
    </script>
    
    ${fixQuestion(questionText)}
    </br>
    (Bitte entscheiden Sie bei jeder Aussage, ob diese zutrifft oder nicht!)
    </br>
    </br>
    
    <table style="width:100%;" onchange="mf${random}Kprime()">
        <tr>
            <td style="width:30px;text-align:center;">
                <b>Ja</b> 
            </td>
            <td style="width:30px;text-align:center;">
                <b>Nein</b>
            </td>
        </tr>
        ${answers.map((answer: any, index: number) =>
        `<tr>
            <td style="text-align:center;">
                <input type="radio" name="mf${random}-kprime${index + 1}" value="1">
            </td>
            <td style="text-align:center;">
                <input type="radio" name="mf${random}-kprime${index + 1}" value="0">
            </td>
            <td>${answer[0]}</td>
        </tr>`
    ).join('\n')}
    </table>
    <span id="mf${random}-kprime">${kprimCode}</span></br></br>`
}

function fixQuestion(question: string) {
    const list = ['nicht', 'kein', 'wenigsten']
    const split = question.split('.');
    split[split.length-1] = split[split.length-1].split(' ').map(word => {
        if (list.filter(listword => word.includes(listword)).length===1)
            return '<b>'+word+'</b>'
        else
            return word
    }).join(' ')

    return split.join('.')
}

function calcKprimCode(input: string) {
    const possibleSolutions = [
        "0000",
        "0001",
        "0010",
        "0011",
        "0100",
        "0101",
        "0110",
        "0111",
        "1000",
        "1001",
        "1010",
        "1011",
        "1100",
        "1101",
        "1110",
        "1111"
    ]

    let solutions: any = []
    possibleSolutions.forEach(possibleSolution => {
        let correct = 0
        possibleSolution.split("").forEach((num, index) => {
            if (input.split("")[index] === num) {
                correct += 1
            }
        })
        if (correct === 4) {
            solutions.push([possibleSolution, 100])
        } else if (correct === 3) {
            solutions.push([possibleSolution, 50])
        } else {
            solutions.push([possibleSolution, 0])
        }
    })
    return '{2:SA:' + solutions.map((solution: any) =>
        `%${solution[1]}%${solution[0]}`
    ).join("~") + '}';
}

export default readFiles;