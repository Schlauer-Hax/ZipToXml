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
    </quiz>`
        })
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

        if (Object.entries(dataoutput).filter((obj: any) => obj[0] === zipFile.name).length === 1) {
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
    zip.file('imsmanifest.xml')!.async('string').then(text => {
        const data = JSON.parse(convert.xml2json(text, { compact: true }));
        const year = data.manifest.resources.resource[0].metadata['imsmd:lom']['imsmd:classification']['imsmd:taxonpath'].find((path: any) => path['imsmd:source']['imsmd:langstring']._text === 'dateOfExam')['imsmd:taxon']['imsmd:entry']['imsmd:langstring']._text.split('.')[2];
        files.forEach((file, index) => {
            file.async("text").then(text => generateText(text, fileName, zip, (index + 1).toLocaleString('en-US', {
                minimumIntegerDigits: 2,
                useGrouping: false
            }), year))
        })
    })
}

// TODO: Image Support
async function generateText(text: string, filename: string, zip: JSZip, number: string, year: string) {
    const data = JSON.parse(convert.xml2json(text, { compact: true }));
    let type;
    if (Array.isArray(data['imsqti:assessmentItem']['imsqti:responseDeclaration'])) {
        receiveData(await handleClozes(data, zip, number, year), filename)
    } else {
        type = data['imsqti:assessmentItem']['imsqti:responseDeclaration']._attributes.cardinality;
        if (type === 'single') {
            receiveData(await handleSingle(data, zip, number, year), filename)
        } else if (type === 'multiple') {
            receiveData(await handleMultiple(data, zip, number, year), filename)
        }
    }
}

async function handleSingle(data: any, zip: JSZip, number: string, year: string) {
    const correctResponseId = data['imsqti:assessmentItem']['imsqti:responseDeclaration']['imsqti:correctResponse']['imsqti:value']._text;
    const answers = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:simpleChoice'];
    const imgdata = await getImages(data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'], zip);
    return `
    <question type="multichoice">
        <name>
            <text><![CDATA[${number} - ${data['imsqti:assessmentItem']._attributes.title}]]></text>
        </name>
        <questiontext format="html">
            <text>
                <![CDATA[${fixQuestion(data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction']['imsqti:prompt']['imsqti:span']
        .map((span: any) => span._text).filter((val: any) => val).join('</br></br>').replaceAll('<neg>', '<strong>').replaceAll('</neg>', '</strong>'))}
                ${imgdata[1]}]]></text>
                ${imgdata[0]}
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
        <tags>
            <tag><text>${year}</text></tag>
        </tags>
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

async function handleMultiple(data: any, zip: JSZip, number: string, year: string) {
    const matchInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:matchInteraction'];
    const imgdata = await getImages(matchInteraction, zip);
    const question = matchInteraction['imsqti:prompt']['imsqti:span'].map((span: any) => span._text).filter((val: any) => val).join('</br></br>');
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
                <text><![CDATA[${number} - ${(data['imsqti:assessmentItem']._attributes.title)}]]></text>
            </name>
            <questiontext format="html">
                <text><![CDATA[${fixQuestion(question)}${imgdata[1]}]]></text>
                ${imgdata[0]}
            </questiontext>
            <defaultgrade>2.0000000</defaultgrade>
            <penalty>0.3333333</penalty>
            <hidden>0</hidden>
            <scoringmethod>
                <text>kprime</text>
            </scoringmethod>
            <tags>
                <tag><text>${year}</text></tag>
            </tags>
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

async function handleClozes(data: any, zip: JSZip, number: string, year: string) {
    let files: any = []

    const out = await Promise.all(data['imsqti:assessmentItem']['imsqti:responseDeclaration'].map(async (responseDeclaration: any, index: number) => {
        if (responseDeclaration._attributes.cardinality === 'multiple') {
            return await handleMultipleCloze(data, responseDeclaration._attributes.identifier, zip, number, year, index+1);
        } else if (responseDeclaration._attributes.cardinality === 'single') {
            return await handleSingleCloze(data, responseDeclaration._attributes.identifier, zip, number, year, index+1);
        }
        return '';
    }))

    console.log(out)

    return `
    <question type="description">
        <name>
          <text><![CDATA[${number} - Fall ${data['imsqti:assessmentItem']._attributes.title}]]></text>
        </name>
        <questiontext format="html">
          <text><![CDATA[
            <u>Fallbeschreibung mit ${data['imsqti:assessmentItem']['imsqti:responseDeclaration'].length} Teilfragen:</u>
            </br>
            ${data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:p']?._text.replaceAll('\n', '</br>')}
        ]]></text>
        </questiontext>
        <generalfeedback format="moodle_auto_format">
          <text></text>
        </generalfeedback>
        <tags>
            <tag><text>${year}</text></tag>
        </tags>
        <penalty>0</penalty>
        <hidden>0</hidden>
    </question> 
    ${out}`
}

async function handleSingleCloze(data: any, id: any, zip: JSZip, number: string, year: string, answernumber: number) {
    const correctResponseId = data['imsqti:assessmentItem']['imsqti:responseDeclaration'].filter((obj: any) => obj._attributes.identifier === id)[0]['imsqti:correctResponse']['imsqti:value']._text;
    let choiceInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:choiceInteraction'];
    if (Array.isArray(choiceInteraction)) {
        choiceInteraction = choiceInteraction.filter(interaction =>
            interaction._attributes.responseIdentifier === id
        )[0]
    }
    const imgdata = await getImages(choiceInteraction, zip)
    return `
    <question type="multichoice">
        <name>
            <text><![CDATA[${number}.${answernumber} Fall - ${data['imsqti:assessmentItem']._attributes.title}]]></text>
        </name>
        <questiontext format="html">
            <text>
                <![CDATA[
                    Teilfrage: ${answernumber} </br>
                    ${choiceInteraction['imsqti:prompt']['imsqti:span'][0]._text ? choiceInteraction['imsqti:prompt']['imsqti:span'][0]._text.replaceAll('\n', '</br>')+'</br></br>' : ''}
                ${fixQuestion(choiceInteraction['imsqti:prompt']['imsqti:span'][1]._text)}
                ${imgdata[1]}]]></text>
                ${imgdata[0]}
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
        <tags>
            <tag><text>${year}</text></tag>
        </tags>
        <shownumcorrect/>
        ${choiceInteraction['imsqti:simpleChoice'].map((answer: any) =>
            `<answer fraction="${correctResponseId === answer._attributes.identifier ? 100 : 0}" format="html">
            <text>
                <![CDATA[${answer._text}]]>
            </text>
        </answer>
        `).join('')
        }
    </question>`
}

async function handleMultipleCloze(data: any, id: any, zip: JSZip, number: string, year: string, answernumber: number) {
    const correctResponseIds = data['imsqti:assessmentItem']['imsqti:responseDeclaration'].filter((response: any) =>
        response._attributes.identifier === id
    )[0]['imsqti:correctResponse']['imsqti:value'].map((obj: any) => obj._text);

    let matchInteraction = data['imsqti:assessmentItem']['imsqti:itemBody']['imsqti:matchInteraction']
    if (Array.isArray(matchInteraction)) {
        matchInteraction = matchInteraction.filter(interaction =>
            interaction._attributes.responseIdentifier === id
        )[0]
    }

    const imgdata = await getImages(matchInteraction, zip)

    const answers = matchInteraction['imsqti:simpleMatchSet'][0]['imsqti:simpleAssociableChoice']
        .map((obj: any) => [
            obj._text,
            correctResponseIds.filter((correct: any) => correct.split(" ")[0] === obj._attributes.identifier)[0].split(" ")[1] === 'richtig'
        ])

    const questionText = matchInteraction['imsqti:prompt']['imsqti:span'][1]._text;

    return `
        <question type="kprime">
            <name>
                <text><![CDATA[${number}.${answernumber} Fall - ${(data['imsqti:assessmentItem']._attributes.title)}]]></text>
            </name>
            <questiontext format="html">
                <text><![CDATA[
                    Teilfrage: ${answernumber} </br>
                    ${fixQuestion(questionText)}${imgdata[1]}]]></text>
                ${imgdata[0]}
            </questiontext>
            <defaultgrade>2.0000000</defaultgrade>
            <penalty>0.3333333</penalty>
            <hidden>0</hidden>
            <scoringmethod>
                <text>kprime</text>
            </scoringmethod>
            <tags>
                <tag><text>${year}</text></tag>
            </tags>
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

async function getImages(interaction: any, zip: JSZip) {
    if (interaction['imsqti:prompt']['imsqti:span'][1]['imsqti:img']) {
        const name = interaction['imsqti:prompt']['imsqti:span'][1]['imsqti:img']._attributes.src;
        const buffer = await zip.file(name)?.async('arraybuffer');

        if (buffer !== undefined) {
            var binary = '';
            var bytes = new Uint8Array(buffer);
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return [`<file name="${name.split('/')[1]}" path="/" encoding="base64">${window.btoa(binary)}</file>`,
            `</br></br><img width="100%" src="@@PLUGINFILE@@/${name.split('/')[1]}">`]
        }
    }
    return ['', '']
}

function fixQuestion(question: string) {
    const list = ['nicht', 'kein', 'wenigsten']
    const split = question.split('.');
    split[split.length - 1] = split[split.length - 1].split(' ').map(word => {
        if (list.filter(listword => word.includes(listword)).length === 1)
            return '<b>' + word + '</b>'
        else
            return word
    }).join(' ')

    return split.join('.')
}

export default readFiles;