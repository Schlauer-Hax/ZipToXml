import JSZip from "jszip";
import convert from 'xml-js'

/*let output: any = []

output.push = (input: any) => {
    Array.prototype.push.call(output, input);
    if (output.length===count) {
        console.log(output)
        setData()
    }
}*/

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
        setData(dataoutput)
        console.log(Object.entries(dataoutput).length)
    }
}

function readFiles(zipfiles: File[], passedfunction: any) {
    setData = passedfunction;
    zipfilecount = zipfiles.length
    zipfiles.forEach(zipfile => {

        selectZip(zipfile);

    })
}

function selectZip(zipfile: File) {
    JSZip.loadAsync(zipfile).then(zip => {
        const files = zip.filter((relativePath, file) => {
            return file.name.endsWith('.zip')
        });

        if (files.length === 1) {
            files[0].async('arraybuffer').then(zip => JSZip.loadAsync(zip).then(zip => readZip(zip, zipfile.name)))
        } else {
            readZip(zip, zipfile.name)
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

function generateText(text: string, filename: string) {
    const data = JSON.parse(convert.xml2json(text, {compact: true}));
    let type;
    if (data['imsqti:assessmentItem']['imsqti:responseDeclaration']._attributes) {
        type = data['imsqti:assessmentItem']['imsqti:responseDeclaration']._attributes.cardinality;
    } else {
        type = data['imsqti:assessmentItem']['imsqti:responseDeclaration'][0]._attributes.cardinality;
    }
    if (type === 'single') {
        if (data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'].length === undefined) {
            receiveData(handleSingle(data), filename)
        } else {
            receiveData(handleCloze(data), filename)
        }
    } else if (type === 'multiple') {
        if (!Array.isArray(data['imsqti:assessmentItem']['imsqti:responseDeclaration'])) {
            receiveData(handleMultiple(data), filename)
        } else {
            receiveData(handleMultipleCloze(data), filename)
        }
    }
}

// TODO: Image Support
// TODO: Pass to output
function handleSingle(data: any) {
    return `
    <question type="multichoice">
        <name>
            <text>${data['imsqti:assessmentItem']._attributes.title}</text>
        </name>
        <questiontext format="html">
            <text>
                <![CDATA[${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:prompt']['imsqti:span']
        .map((span: any) => span._text).filter((val: any) => val).join('\n\n').replaceAll('<neg>', '<strong>').replaceAll('</neg>', '</strong>')}]]></text>
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
        ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:simpleChoice'].map((answer: any) =>
        `<answer fraction="${data['imsqti:assessmentItem']['imsqti:responseDeclaration']['imsqti:correctResponse']['imsqti:value']._text === answer._attributes.identifier ? 100 : 0}" format="html">
            <text>
                <![CDATA[${answer._text}]]>
            </text>
        </answer>
        `).join('')
    }
    </question>`
}

// TODO: Image Support
// TODO: Pass to output
function handleCloze(data: any) {
    return `
<!-- question: 9233  -->
  <question type="cloze">
    <name>
      <text>Fall ${data['imsqti:assessmentItem']._attributes.title}</text>
    </name>
    <questiontext format="html">
      <text>
        <![CDATA[
            <p dir="ltr" style="text-align: left;">
                ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:p']._text}
                <br>
            </p>
            <p dir="ltr" style="text-align: left;">
                (Die folgenden 4 Fragen beziehen sich auf obigen Fall.)
                <br>
            </p>
            ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'].map((question: any) =>
        `
                    <p dir="ltr" style="text-align: left;">
                        <br>
                    </p>            
                    <p dir="ltr" style="text-align: left;">
                        <strong>Frage ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'].indexOf(question) + 1}:</strong>
                    </p>
                    <p dir="ltr" style="text-align: left;">
                        ${question['imsqti:prompt']['imsqti:span'][1]._text}
                    </p>
                    <p dir="ltr" style="text-align: left;">
                        Wählen Sie eine Antwort:
                        <br>
                    </p>
                    <p dir="ltr" style="text-align: left;">
                        {1:MCVS:${question['imsqti:simpleChoice'].map((answer: any) =>
            `~${data['imsqti:assessmentItem']['imsqti:responseDeclaration'][data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'].indexOf(question)]['imsqti:correctResponse']['imsqti:value']._text === answer._attributes.identifier ? '%100%' : ''}&amp;nbsp;&amp;nbsp;${answer._text}`
        ).join('')}}
                        <br>
                    </p>
                `
    ).join('')}
            ]]></text>
    </questiontext>
    <generalfeedback format="html">
      <text></text>
    </generalfeedback>
    <penalty>0.3333333</penalty>
    <hidden>0</hidden>
    <idnumber></idnumber>
  </question>
`
}

// TODO: Image Support
// TODO: Pass to output
function handleMultiple(data: any) {
    /*return `
      <question type="cloze">
        <name>
          <text>Kprime</text>
        </name>
        <questiontext format="html">
          <text>
              <![CDATA[
                <!--
                Copyright 2021 by Dominique Bauer.
                Creative Commons CC0 1.0 Universal Public Domain Dedication.
                -->

                <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        document.querySelector("table.answer").css.border = "none";
                        document.querySelector("table.answer tr").css.border = "none";
                        document.querySelector("table.answer td").css.width = "90px";
                    });
                </script>

                <h3 style="margin-top:5px;">
                    Simulate the Kprime question type
                </h3>
                <br>
                <table>
                    <tr>
                        <td>
                        </td>
                        <td style="width:180px;font-weight:bold;">
                            &nbsp;Yes &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; No
                        </td>
                    </tr>
                    ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:matchInteraction']['imsqti:simpleMatchSet'][0]['imsqti:simpleAssociableChoice'].map((answer: any) =>
        `<tr>
                        <td>${answer._text}</td>
                        ${data['imsqti:assessmentItem']['imsqti:responseDeclaration']['imsqti:correctResponse']['imsqti:value'].filter((check: any) =>
            check._text.split(" ")[0] === answer._attributes.identifier
        )[0]._text.split(' ')[1] === 'richtig' ? '<td>{1:MCH:~%-100%&nbsp;~%100%&nbsp;}</td>' : '<td>{1:MCH:~%100%&nbsp;~%-100%&nbsp;}</td>'}
                    </tr>
                    `
    ).join('')}
                </table>
            ]]>
        </text>
        </questiontext>
        <generalfeedback format="moodle_auto_format">
          <text></text>
        </generalfeedback>
        <penalty>0.3333333</penalty>
        <hidden>0</hidden>
        <idnumber>question_20210726_1235</idnumber>
      </question>
    `*/
    return `
    
    `
}

function handleMultipleCloze(data: any) {

}

export default readFiles;